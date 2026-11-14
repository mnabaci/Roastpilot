import {
  DEFAULT_COOLING_MS,
  FanInterlockDriver,
  ManualClock,
  ManualRoast,
  ReadingHistory,
  RoasterSession,
  silentLogger,
} from '@roastpilot/core';
import type { Reading, SafetyEvent } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { SimulatedDriver } from './simulated-driver';

const MIN_FAN = 40;

/**
 * A generic TC4 air roaster as main wires one: the session around the fan interlock around the
 * roaster, and the roast flow told it has only a heater and a fan (no cooler, no drum).
 */
function airRoaster() {
  const clock = new ManualClock();
  const sim = new SimulatedDriver({ clock });
  const driver = new FanInterlockDriver(sim, MIN_FAN, silentLogger);
  const history = new ReadingHistory();
  const safety: SafetyEvent[] = [];
  const sent: [string, number][] = [];
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
    setOutput: (c, v) => {
      sent.push([c, v]);
      return session.setOutput(c, v);
    },
    latestBt: () => history.latest()?.values.bt,
    readings: (): readonly Reading[] => history.all(),
    hasOutput: (channel) => channel === 'heater' || channel === 'fan',
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
  const tripped = () => safety.flatMap((e) => (e.kind === 'tripped' ? [e.rule] : []));
  return { clock, sim, driver, session, roast, sent, failures, outputs, tripped };
}

describe('a generic TC4 air roaster through the session', () => {
  it('a cable pulled mid-roast ends with the heater off and locked, and the fan raised after', async () => {
    const r = airRoaster();
    await r.session.connect(r.driver, { kind: 'simulator' });
    await r.roast.act('start');
    await r.session.setOutput('fan', 50);
    await r.session.setOutput('heater', 80);
    await r.clock.runFor(60_000);
    r.sim.unplug();
    await r.clock.runFor(15_000);
    expect(r.tripped()).toContain('lost-connection');
    r.sim.plugIn();
    await r.clock.runFor(30_000);
    expect(r.session.connection.status).toBe('connected');
    expect(r.session.safetyStatus.locked).toBe(true);
    expect((await r.outputs()).heater).toBe(0);
    expect((await r.session.setOutput('heater', 60)).ok).toBe(false);
    expect((await r.outputs()).heater).toBe(0);
    // Acknowledged: heat again, and the interlock raises the fan first, as after any reconnect.
    expect(r.session.acknowledgeSafety().ok).toBe(true);
    await r.session.setOutput('fan', 0);
    expect((await r.session.setOutput('heater', 60)).ok).toBe(true);
    expect(await r.outputs()).toMatchObject({ heater: 60, fan: MIN_FAN });
  });

  it('drop and cooling finish on heater and fan alone, never touching a cooler or drum', async () => {
    const r = airRoaster();
    await r.session.connect(r.driver, { kind: 'simulator' });
    await r.roast.act('start');
    await r.session.setOutput('heater', 70);
    await r.clock.runFor(5 * 60_000);
    await r.roast.act('drop');
    await r.clock.runFor(DEFAULT_COOLING_MS + 60_000);
    expect(r.roast.state.phase).toBe('done');
    expect(r.sent.filter(([channel]) => channel !== 'heater' && channel !== 'fan')).toEqual([]);
    expect(await r.outputs()).toMatchObject({ heater: 0, cooling: 0, drum: 0 });
    expect(r.tripped()).toEqual([]);
    expect(r.failures).toEqual([]);
  });
});
