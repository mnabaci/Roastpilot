import {
  AutoPilot,
  ManualClock,
  ManualRoast,
  quantize,
  rateOfRise,
  ReadingHistory,
  RoasterSession,
} from '@roastpilot/core';
import type { AutoEvent } from '@roastpilot/core';
import type { AutoProfile, AutoTuning, Reading, SafetyEvent } from '@roastpilot/shared';
import { SimulatedDriver } from './simulated/simulated-driver';
import { SKYWALKER_CHANNELS } from './skywalker';

export interface SimulationOptions {
  profile: AutoProfile;
  tuning: AutoTuning;
  soakS?: number;
  /** Press First crack at this temperature; never when undefined. */
  firstCrackAtC?: number;
  ambientC?: number;
}

export interface SimulatedRow {
  tS: number;
  bt: number;
  ror: number | undefined;
  heater: number;
  fan: number;
  phase: string | null;
}

/**
 * One whole Auto roast on the simulated Skywalker and a fake clock, through the same session,
 * flow and pilot the app runs: Preheat, Charge soon, beans in, Start, First crack, auto drop.
 */
export async function simulateAutoRoast(options: SimulationOptions) {
  const { profile, tuning, soakS = 60, firstCrackAtC, ambientC } = options;
  const clock = new ManualClock();
  const driver = new SimulatedDriver({
    clock,
    constants: ambientC === undefined ? {} : { ambientC },
  });
  const history = new ReadingHistory();
  const safety: SafetyEvent[] = [];
  const events: AutoEvent[] = [];
  const rows: SimulatedRow[] = [];
  const failures: unknown[] = [];
  const failed = (error: unknown) => {
    failures.push(error);
  };

  const session = new RoasterSession({
    clock,
    onReading: (reading: Reading) => {
      history.add(reading);
      roast.onReading(reading).catch(failed);
      pilot.onReading(reading).catch(failed);
    },
    onConnection: () => undefined,
    onSafetyEvent: (event) => {
      safety.push(event);
      if (event.kind === 'tripped' && event.action === 'safe-stop') pilot.stop(event.rule);
    },
  });
  const roast = new ManualRoast({
    clock,
    setOutput: (channel, value) => session.setOutput(channel, value),
    latestBt: () => history.latest()?.values.bt,
    readings: () => history.all(),
    onChange: () => undefined,
    onNewRoast: () => {
      history.clear();
    },
    onRoastStarted: (atMs) => {
      session.roastStarted(atMs);
    },
    onTurningPoint: (atMs) => {
      session.turningPoint(atMs);
    },
    onRoastEnded: () => {
      session.roastEnded();
    },
  });
  const pilot = new AutoPilot({
    roast: () => roast.state,
    readings: () => history.all(),
    setOutput: (channel, value) => session.setOutput(channel, value),
    round: (id, value) => {
      const channel = SKYWALKER_CHANNELS.find((c) => c.id === id);
      return channel?.kind === 'output' ? quantize(channel, value) : value;
    },
    heaterLocked: () => session.safetyStatus.locked,
    drop: async () => {
      await roast.act('drop');
    },
    profile: () => profile,
    tuning: () => tuning,
    soakS: () => soakS,
    onEvent: (event) => events.push(event),
    onChange: () => undefined,
  });
  pilot.setEnabled(true);

  await session.connect(driver, { kind: 'simulator' });
  await roast.act('preheat');

  const runUntil = async (done: () => boolean, limitMs: number): Promise<boolean> => {
    const endMs = clock.now() + limitMs;
    while (!done() && clock.now() < endMs) await clock.runFor(1_000);
    return done();
  };

  const preheatStarted = clock.now();
  const reachedAddBeans = await runUntil(
    () => pilot.status.preheatStep === 'add-beans' || pilot.status.stopped,
    40 * 60_000,
  );
  const preheatMs = clock.now() - preheatStarted;
  const btAtAddBeans = history.latest()?.values.bt;
  pilot.chargeSoon(clock.now());
  await runUntil(() => pilot.status.preheatStep === 'beans-in', 30_000);
  const btAtCharge = history.latest()?.values.bt;
  driver.chargeBeans();
  await clock.runFor(2_000);
  await roast.act('start');

  let lastRowS = -1;
  const roastEnded = await runUntil(() => {
    const { phase, chargedAtMs } = roast.state;
    const latest = history.latest();
    const bt = latest?.values.bt;
    if (latest && chargedAtMs !== null && bt !== undefined) {
      const tS = (latest.atMs - chargedAtMs) / 1_000;
      if (tS - lastRowS >= 1) {
        lastRowS = tS;
        rows.push({
          tS,
          bt,
          ror: rateOfRise(history.all().filter((r) => r.atMs >= chargedAtMs)),
          heater: latest.values.heater ?? 0,
          fan: latest.values.fan ?? 0,
          phase: pilot.status.phaseName,
        });
      }
      if (phase === 'roasting' && firstCrackAtC !== undefined && bt >= firstCrackAtC) {
        roast.act('first-crack').catch(failed);
      }
    }
    return phase === 'cooling' || phase === 'done';
  }, 25 * 60_000);

  const finalState = roast.state;
  await session.disconnect();
  return {
    reachedAddBeans,
    preheatMs,
    btAtAddBeans,
    btAtCharge,
    roastEnded,
    rows,
    events,
    safety,
    failures,
    finalState,
    stopped: pilot.status.stopped,
  };
}
