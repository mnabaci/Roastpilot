import {
  DEFAULT_COOLING_MS,
  ManualClock,
  ManualRoast,
  rateOfRise,
  ReadingHistory,
  RoasterSession,
} from '@roastpilot/core';
import type { Reading, SafetyEvent } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver } from './simulated-driver';

/** The app's wiring in main, on fake time. */
function roaster() {
  const clock = new ManualClock();
  const sim = new SimulatedDriver({ clock });
  const history = new ReadingHistory();
  const safety: SafetyEvent[] = [];
  const failures: unknown[] = [];
  const session = new RoasterSession({
    clock,
    onReading: (r) => {
      history.add(r);
      roast.onReading(r).catch((error: unknown) => failures.push(error));
    },
    onConnection: () => undefined,
    onSafetyEvent: (e) => safety.push(e),
  });
  const roast = new ManualRoast({
    clock,
    setOutput: (c, v) => session.setOutput(c, v),
    latestBt: () => history.latest()?.values.bt,
    readings: (): readonly Reading[] => history.all(),
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
  /** Runs a second at a time until `done`, failing after `maxMs` so a wrong model can't hang. */
  const runUntil = async (done: () => boolean, maxMs: number) => {
    for (let ms = 0; !done(); ms += 1000) {
      if (ms >= maxMs) throw new Error(`not reached in ${maxMs} ms; BT ${bt()} °C`);
      await clock.runFor(1000);
    }
  };
  return { clock, sim, session, roast, history, safety, failures, outputs, bt, runUntil };
}

describe('a manual roast on the simulated Skywalker', () => {
  it('preheats, roasts, cracks, drops, cools beans then the roaster, with no safety trips', async () => {
    const { sim, session, roast, history, safety, failures, outputs, bt, runUntil, clock } =
      roaster();
    await session.connect(sim, { kind: 'simulator' });

    await roast.act('preheat');
    await session.setOutput('heater', 100);
    await session.setOutput('fan', 30);
    await runUntil(() => bt() >= 180, 10 * 60_000);

    // Driven like batch 2 of 2026-11-04: heater off through the dip, then less heat, more fan.
    sim.chargeBeans();
    await roast.act('start');
    await session.setOutput('heater', 0);
    await clock.runFor(30_000);
    expect(rateOfRise(history.all())).toBeLessThan(0);
    await clock.runFor(30_000);
    await session.setOutput('heater', 85);
    await runUntil(() => (rateOfRise(history.all()) ?? 0) > 0, 3 * 60_000);
    expect(roast.state.events.map((e) => e.kind)).toContain('turning-point');
    await runUntil(() => bt() >= 150, 8 * 60_000);
    await session.setOutput('heater', 60);
    await session.setOutput('fan', 55);
    await runUntil(() => bt() >= 180, 8 * 60_000);
    await session.setOutput('heater', 35);
    await session.setOutput('fan', 90);
    await runUntil(() => bt() >= 190, 8 * 60_000);
    await roast.act('first-crack');
    await clock.runFor(70_000);
    await roast.act('drop');
    sim.dumpBeans();
    expect(await outputs()).toMatchObject({ heater: 0, fan: 100 });

    // Like the real roaster, the drum is still hot when the beans are cool: the roaster cools down.
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(roast.state.phase).toBe('done');
    expect(roast.state.events.map((e) => e.kind)).toEqual([
      'charge',
      'turning-point',
      'first-crack',
      'drop',
      'cool-end',
    ]);
    expect(roast.state.events[2]?.bt).toBeGreaterThanOrEqual(190);
    expect(roast.state.roasterCoolingSinceMs).not.toBeNull();
    expect(await outputs()).toMatchObject({ heater: 0, fan: 100, cooling: 0 });

    // The fitted model cools an empty drum more slowly than measured, so this may end on the
    // 15 min limit rather than below 50 °C; either way everything ends off.
    await runUntil(() => roast.state.roasterCoolingSinceMs === null, 16 * 60_000);
    expect(bt()).toBeLessThan(60);
    expect(await outputs()).toMatchObject({ heater: 0, fan: 0 });
    expect(safety).toEqual([]);
    expect(failures).toEqual([]);
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
