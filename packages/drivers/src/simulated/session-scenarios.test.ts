import { ManualClock, RoasterSession } from '@roastpilot/core';
import type { ConnectionState, Reading, SafetyEvent } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver } from './simulated-driver';

function setup() {
  const clock = new ManualClock();
  const sim = new SimulatedDriver({ clock });
  const readings: Reading[] = [];
  const states: ConnectionState['status'][] = [];
  const events: SafetyEvent[] = [];
  const session = new RoasterSession({
    clock,
    onReading: (r) => readings.push(r),
    onConnection: (s) => states.push(s.status),
    onSafetyEvent: (e) => events.push(e),
  });
  const heater = async () => {
    const r = await sim.read();
    return r.ok ? r.value.values.heater : undefined;
  };
  return { clock, sim, session, readings, states, events, heater };
}

describe('RoasterSession on the simulated Skywalker', () => {
  it('heats under manual control and publishes rising readings', async () => {
    const { clock, sim, session, readings } = setup();
    await session.connect(sim, { kind: 'simulator' });
    await session.setOutput('heater', 100);
    await clock.runFor(60_000);
    expect(readings.length).toBeGreaterThanOrEqual(60);
    expect(readings.at(-1)?.values.bt).toBeGreaterThan(45);
  });

  it('a pulled cable goes lost, reconnects by itself and sends the second safe stop', async () => {
    const { clock, sim, session, states, events, heater } = setup();
    await session.connect(sim, { kind: 'simulator' });
    await session.setOutput('heater', 60);
    await clock.runFor(10_000);
    sim.unplug();
    await clock.runFor(5_000);
    expect(states.at(-1)).toBe('lost');

    sim.plugIn();
    await clock.runFor(3_000);
    expect(states.at(-1)).toBe('connected');
    expect(await heater()).toBe(0);
    expect(events.map((e) => e.kind)).toEqual(['tripped', 'cleared']);
    expect(await session.setOutput('heater', 60)).toEqual({
      ok: false,
      error: { kind: 'safety-locked', channel: 'heater' },
    });
  });

  it('disconnect leaves the roaster safe-stopped and raises no alarm', async () => {
    const { clock, sim, session, events } = setup();
    await session.connect(sim, { kind: 'simulator' });
    await session.setOutput('heater', 80);
    await clock.runFor(5_000);
    await session.disconnect();
    // Straight away, before the sketch watchdog could switch things off by itself: fan 100 is the safe stop.
    await sim.connect();
    expect(await sim.read()).toMatchObject({
      ok: true,
      value: { values: { heater: 0, fan: 100 } },
    });
    await sim.disconnect();
    await clock.runFor(30_000);
    expect(events).toEqual([]);
  });
});
