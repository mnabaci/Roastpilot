import {
  DEFAULT_COOLING_MS,
  ManualClock,
  silentLogger,
  type RoastRepository,
  type SettingsStore,
} from '@roastpilot/core';
import { SimulatedDriver } from '@roastpilot/drivers';
import { drizzleOn, openDatabase, SqliteRoastRepository } from '@roastpilot/storage';
import { DEFAULT_SETTINGS, IPC_CHANNELS, ok } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createAppServices } from './app-services';
import { unavailableRepository } from './history/unavailable-repository';

function setup(roasts: RoastRepository = unavailableRepository('not in this test')) {
  const clock = new ManualClock();
  const published: [string, unknown][] = [];
  const settingsStore: SettingsStore = {
    load: () => Promise.resolve(DEFAULT_SETTINGS),
    save: () => Promise.resolve(ok(undefined)),
  };
  const services = createAppServices({
    clock,
    logger: silentLogger,
    settingsStore,
    roasts,
    nowIso: () => '2026-11-04T10:00:00.000Z',
    onConnectionChange: () => undefined,
    publish: (channel, payload) => {
      published.push([channel, payload]);
    },
  });
  return { clock, services, published, sim: new SimulatedDriver({ clock }) };
}

describe('createAppServices', () => {
  it('publishes connection, readings and roast changes to the windows', async () => {
    const { clock, services, published, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await clock.runFor(2000);
    await services.roast.act('preheat');
    const channels = new Set(published.map(([c]) => c));
    expect(channels).toEqual(
      new Set([IPC_CHANNELS.connection, IPC_CHANNELS.reading, IPC_CHANNELS.roast]),
    );
  });

  it('gives a reloading window everything it needs', async () => {
    const { clock, services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('start');
    await clock.runFor(5000);
    services.session.emergencyStop();
    const snapshot = services.snapshot();
    expect(snapshot.connection.status).toBe('connected');
    expect(snapshot.roast.phase).toBe('roasting');
    expect(snapshot.readings.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.safety).toEqual({ locked: true, tripped: [] });
  });

  it('starts a fresh chart at Preheat, and stamps events with the latest temperature', async () => {
    const { clock, services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await clock.runFor(10_000);
    await services.roast.act('preheat');
    expect(services.snapshot().readings).toEqual([]);
    await clock.runFor(3000);
    await services.roast.act('start');
    expect(services.roast.state.events[0]?.bt).toBe(services.snapshot().readings.at(-1)?.values.bt);
  });

  it('arms max roast time at Start through the session', async () => {
    const { clock, services, published, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('start');
    await clock.runFor(20 * 60_000 + 2000);
    expect(
      published.some(
        ([c, p]) =>
          c === IPC_CHANNELS.safetyEvent && (p as { rule?: string }).rule === 'max-roast-time',
      ),
    ).toBe(true);
  });

  it('a new connection mid-roast turns the drum and filter fan back on, not the heater', async () => {
    const { clock, services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('preheat');
    await services.session.connect(new SimulatedDriver({ clock }), { kind: 'simulator' });
    await clock.runFor(2000);
    expect(services.roast.state.phase).toBe('preheat');
    expect(services.snapshot().readings.at(-1)?.values).toMatchObject({
      drum: 1,
      filter: 1,
      heater: 0,
    });
  });

  it('readings back after a lost connection put the roast outputs back', async () => {
    const { clock, services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('start');
    sim.unplug();
    // Past the sketch's 10 s watchdog, which switches everything off.
    await clock.runFor(15_000);
    sim.plugIn();
    await clock.runFor(3000);
    expect(services.snapshot().connection.status).toBe('connected');
    expect(services.snapshot().readings.at(-1)?.values).toMatchObject({ drum: 1, filter: 1 });
  });

  it('saves the roast from Preheat to cool end, and tells the windows', async () => {
    const opened = openDatabase(':memory:', silentLogger);
    if (!opened.ok) throw new Error('no database');
    const roasts = new SqliteRoastRepository(drizzleOn(opened.value), silentLogger);
    const { clock, services, published, sim } = setup(roasts);
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('preheat');
    await clock.runFor(5000);
    await services.roast.act('start');
    await clock.runFor(10_000);
    await services.roast.act('drop');
    await clock.runFor(DEFAULT_COOLING_MS + 2000);
    await services.recorder.flush();

    const [saved] = await services.history.list();
    expect(saved).toMatchObject({ id: 1, endedAt: '2026-11-04T10:00:00.000Z', dropTimeS: 10 });
    const detail = await services.history.get(1);
    expect(detail.ok && detail.value.events.map((e) => e.kind)).toEqual([
      'charge',
      'drop',
      'cool-end',
    ]);
    expect(detail.ok && detail.value.samples[0]?.tS).toBeLessThan(0);
    expect(published.filter(([c]) => c === IPC_CHANNELS.roastsChanged)).toEqual([
      [IPC_CHANNELS.roastsChanged, { id: 1 }],
      [IPC_CHANNELS.roastsChanged, { id: 1 }],
    ]);
  });
});
