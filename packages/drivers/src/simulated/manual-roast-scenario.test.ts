import {
  DEFAULT_COOLING_MS,
  ManualClock,
  ManualRoast,
  rateOfRise,
  ReadingHistory,
  RoasterSession,
} from '@roastpilot/core';
import type { SafetyEvent } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver } from './simulated-driver';

/** The app's wiring in main, on fake time. */
function roaster() {
  const clock = new ManualClock();
  const sim = new SimulatedDriver({ clock });
  const history = new ReadingHistory();
  const safety: SafetyEvent[] = [];
  const session = new RoasterSession({
    clock,
    onReading: (r) => {
      history.add(r);
    },
    onConnection: () => undefined,
    onSafetyEvent: (e) => safety.push(e),
  });
  const roast = new ManualRoast({
    clock,
    setOutput: (c, v) => session.setOutput(c, v),
    latestBt: () => history.latest()?.values.bt,
    onChange: () => undefined,
    onNewRoast: () => {
      history.clear();
    },
    onRoastStarted: () => {
      session.roastStarted();
    },
    onRoastEnded: () => {
      session.roastEnded();
    },
  });
  const outputs = async () => {
    const r = await sim.read();
    return r.ok ? r.value.values : {};
  };
  const bt = () => history.latest()?.values.bt ?? Number.NaN;
  return { clock, sim, session, roast, history, safety, outputs, bt };
}

describe('a manual roast on the simulated Skywalker', () => {
  it('preheats, roasts, cracks, drops, cools and switches off, with no safety trips', async () => {
    const { clock, sim, session, roast, history, safety, outputs, bt } = roaster();
    await session.connect(sim, { kind: 'simulator' });

    await roast.act('preheat');
    // Heater 100 with fan 30 levels off near 236 °C on the simulator: past first crack, under the 240 °C limit.
    await session.setOutput('heater', 100);
    await session.setOutput('fan', 30);
    while (bt() < 180) await clock.runFor(1000);

    await roast.act('start');
    await clock.runFor(60_000);
    expect(rateOfRise(history.all())).toBeGreaterThan(0);

    while (bt() < 196) await clock.runFor(1000);
    await roast.act('first-crack');
    await clock.runFor(70_000);
    await roast.act('drop');
    expect(await outputs()).toMatchObject({ heater: 0, fan: 100 });

    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state.phase).toBe('done');
    expect(roast.state.events.map((e) => e.kind)).toEqual([
      'charge',
      'first-crack',
      'drop',
      'cool-end',
    ]);
    expect(roast.state.events[1]?.bt).toBeGreaterThanOrEqual(196);
    expect(await outputs()).toMatchObject({ heater: 0, fan: 0 });
    expect(safety).toEqual([]);
  });

  it('drop stands down max roast time, so a long cooling never trips it', async () => {
    const { clock, sim, session, roast, safety } = roaster();
    await session.connect(sim, { kind: 'simulator' });
    await roast.act('start');
    await clock.runFor(19 * 60_000);
    await roast.act('drop');
    await clock.runFor(5 * 60_000);
    expect(safety.filter((e) => e.kind === 'tripped')).toEqual([]);
  });
});
