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

type Rig = ReturnType<typeof buildRig>;

/** The simulated Skywalker on a fake clock, wired to the same session, roast and pilot as the app. */
function buildRig({ profile, tuning, ambientC }: SimulationOptions) {
  const clock = new ManualClock();
  const driver = new SimulatedDriver({
    clock,
    constants: ambientC === undefined ? {} : { ambientC },
  });
  const history = new ReadingHistory();
  const safety: SafetyEvent[] = [];
  const events: AutoEvent[] = [];
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
      if (event.kind === 'tripped' && event.action === 'safe-stop') pilot.stop('safety-stop');
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
    // A first batch: the simulations start from a cold roaster.
    preheatHold: () => ({ s: tuning.holdS, batch: 'first' }),
    onEvent: (event) => events.push(event),
    onChange: () => undefined,
  });
  pilot.setEnabled(true);
  return { clock, driver, history, session, roast, pilot, safety, events, failures, failed };
}

/** Runs the clock a second at a time until `done`, or the limit; says whether it got there. */
async function runUntil(rig: Rig, done: () => boolean, limitMs: number): Promise<boolean> {
  const endMs = rig.clock.now() + limitMs;
  while (!done() && rig.clock.now() < endMs) await rig.clock.runFor(1_000);
  return done();
}

/** Preheat, Charge soon, beans in, Start: what the roaster does before the roast proper. */
async function preheatAndCharge(rig: Rig) {
  const { clock, driver, history, roast, pilot } = rig;
  await roast.act('preheat');
  const preheatStarted = clock.now();
  const reachedAddBeans = await runUntil(
    rig,
    () => pilot.status.preheatStep === 'add-beans' || pilot.status.stopReason !== null,
    40 * 60_000,
  );
  const preheatMs = clock.now() - preheatStarted;
  const btAtAddBeans = history.latest()?.values.bt;
  pilot.chargeSoon(clock.now());
  await runUntil(rig, () => pilot.status.preheatStep === 'beans-in', 30_000);
  const btAtCharge = history.latest()?.values.bt;
  // Start as the beans go in, as in the app: the real probe reads charge temperature at 0:00.
  driver.chargeBeans();
  await roast.act('start');
  return { reachedAddBeans, preheatMs, btAtAddBeans, btAtCharge };
}

/** Roasts until the drop, a row a second, pressing First crack at `firstCrackAtC`. */
async function roastToDrop(rig: Rig, firstCrackAtC: number | undefined) {
  const { history, roast, pilot } = rig;
  const rows: SimulatedRow[] = [];
  let lastRowS = -1;
  const roastEnded = await runUntil(
    rig,
    () => {
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
          roast.act('first-crack').catch(rig.failed);
        }
      }
      return phase === 'cooling' || phase === 'done';
    },
    25 * 60_000,
  );
  return { roastEnded, rows };
}

/**
 * One whole Auto roast on the simulated Skywalker and a fake clock, through the same session,
 * flow and pilot the app runs: Preheat, Charge soon, beans in, Start, First crack, auto drop.
 */
export async function simulateAutoRoast(options: SimulationOptions) {
  const rig = buildRig(options);
  await rig.session.connect(rig.driver, { kind: 'simulator' });
  const charged = await preheatAndCharge(rig);
  const { roastEnded, rows } = await roastToDrop(rig, options.firstCrackAtC);
  const finalState = rig.roast.state;
  await rig.session.disconnect();
  return {
    ...charged,
    roastEnded,
    rows,
    events: rig.events,
    safety: rig.safety,
    failures: rig.failures,
    finalState,
    stopped: rig.pilot.status.stopReason !== null,
  };
}
