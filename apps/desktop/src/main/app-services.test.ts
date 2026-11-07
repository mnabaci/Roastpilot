import {
  DEFAULT_COOLING_MS,
  ManualClock,
  silentLogger,
  type RoastRepository,
  type SettingsStore,
} from '@roastpilot/core';
import { SimulatedDriver } from '@roastpilot/drivers';
import { drizzleOn, openDatabase, SqliteRoastRepository } from '@roastpilot/storage';
import { DEFAULT_SETTINGS, IPC_CHANNELS, ok, type Settings } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { createAppServices } from './app-services';
import {
  unavailableBeans,
  unavailableProfiles,
  unavailableRepository,
  unavailableRoasters,
} from './history/unavailable-repository';

function setup(
  roasts: RoastRepository = unavailableRepository('not in this test'),
  settings: Partial<Settings> = {},
) {
  const clock = new ManualClock();
  const published: [string, unknown][] = [];
  const settingsStore: SettingsStore = {
    load: () => Promise.resolve({ ...DEFAULT_SETTINGS, ...settings }),
    save: () => Promise.resolve(ok(undefined)),
  };
  const services = createAppServices({
    clock,
    logger: silentLogger,
    settingsStore,
    roasts,
    profileStore: unavailableProfiles('not in this test'),
    roasterStore: unavailableRoasters('not in this test'),
    beanStore: unavailableBeans('not in this test'),
    newProfileId: () => 'custom-1',
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
      new Set([
        IPC_CHANNELS.connection,
        IPC_CHANNELS.reading,
        IPC_CHANNELS.roast,
        IPC_CHANNELS.autoStatus,
      ]),
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
    // The Simulator's drum has a speed: back at the roaster's usual 60 %.
    expect(services.snapshot().readings.at(-1)?.values).toMatchObject({
      drum: 60,
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
    expect(services.snapshot().readings.at(-1)?.values).toMatchObject({ drum: 60, filter: 1 });
  });

  it('cools the beans for the Cooling time setting', async () => {
    const { clock, services, sim } = setup(undefined, { coolingTimeMin: 2 });
    await services.settings.get();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('start');
    await services.roast.act('drop');
    expect(services.roast.state.coolingEndsAtMs).toBe(clock.now() + 2 * 60_000);
  });

  it('a safety stop ends the roaster cool-down, and none starts while locked', async () => {
    const { services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('cool-roaster');
    services.session.emergencyStop();
    expect(services.roast.state.roasterCoolingSinceMs).toBeNull();
    expect(await services.roast.act('cool-roaster')).toMatchObject({ ok: false });
  });

  it('a disconnect ends the roaster cool-down', async () => {
    const { services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('cool-roaster');
    await services.session.disconnect();
    expect(services.roast.state.roasterCoolingSinceMs).toBeNull();
  });

  it('on a Skywalker the bean cooler stays on while the drum cools after the beans', async () => {
    const { clock, services, sim } = setup(undefined, { coolingTimeMin: 2 });
    await services.settings.get();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.session.setOutput('heater', 100);
    await clock.runFor(4 * 60_000);
    await services.roast.act('start');
    await services.roast.act('drop');
    await clock.runFor(2 * 60_000 + 2000);
    expect(services.roast.state).toMatchObject({ phase: 'done' });
    expect(services.roast.state.roasterCoolingSinceMs).not.toBeNull();
    expect(services.snapshot().readings.at(-1)?.values).toMatchObject({
      fan: 100,
      cooling: 100,
      drum: 60,
      filter: 0,
    });
  });

  it('disconnected during bean cooling: drum cooling ends and does not come back', async () => {
    const { clock, services, sim } = setup();
    await services.session.connect(sim, { kind: 'simulator' });
    await services.session.setOutput('heater', 100);
    await clock.runFor(4 * 60_000);
    await services.roast.act('start');
    await services.roast.act('drop');
    await services.session.disconnect();
    await clock.runFor(DEFAULT_COOLING_MS);
    expect(services.roast.state).toMatchObject({ phase: 'done', roasterCoolingSinceMs: null });
  });

  it('finds the charge point and the turning point from the roaster readings', async () => {
    const { clock, services, sim, published } = setup();
    const turningPoint = vi.spyOn(services.session, 'turningPoint');
    await services.session.connect(sim, { kind: 'simulator' });
    await services.roast.act('preheat');
    await services.session.setOutput('heater', 100);
    await clock.runFor(2 * 60_000);
    sim.chargeBeans();
    const beansInMs = clock.now();
    // Start pressed 7 s after the beans went in.
    await clock.runFor(7000);
    await services.roast.act('start');
    const { chargedAtMs } = services.roast.state;
    expect(chargedAtMs).toBeLessThan(beansInMs + 3000);
    expect(chargedAtMs).toBeGreaterThanOrEqual(beansInMs - 1000);
    await services.session.setOutput('heater', 70);
    await clock.runFor(3 * 60_000);
    const tp = services.roast.state.events.find((e) => e.kind === 'turning-point');
    expect(tp?.bt).toBeGreaterThan(50);
    expect(tp?.bt).toBeLessThan(150);
    expect(turningPoint).toHaveBeenCalledExactlyOnceWith(tp?.atMs);
    // Heater 70 % through the charge dip: no stalled-temperature alarm.
    const stalls = published.filter(
      ([channel, event]) =>
        channel === IPC_CHANNELS.safetyEvent && (event as { rule?: string }).rule === 'slow-rise',
    );
    expect(stalls).toEqual([]);
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
      [IPC_CHANNELS.roastsChanged, { id: 1, deleted: false, current: true }],
      [IPC_CHANNELS.roastsChanged, { id: 1, deleted: false, current: true }],
    ]);
  });

  describe('Auto', () => {
    const AUTO = { roastMode: 'auto', soakTimeS: 45 } as const;

    function autoSetup(settings: Partial<Settings> = AUTO) {
      const opened = openDatabase(':memory:', silentLogger);
      if (!opened.ok) throw new Error('no database');
      const repository = new SqliteRoastRepository(drizzleOn(opened.value), silentLogger);
      return { repository, ...setup(repository, settings) };
    }

    const outputs = (sim: SimulatedDriver) => {
      const set = vi.spyOn(sim, 'setOutput');
      return () => set.mock.calls.map(([channel]) => channel);
    };

    it('stays off on Manual: nothing but your own commands reach the roaster', async () => {
      const { clock, services, sim } = autoSetup({});
      await services.settings.get();
      const sent = outputs(sim);
      await services.session.connect(sim, { kind: 'simulator' });
      await services.roast.act('preheat');
      await clock.runFor(5000);
      expect(sent()).not.toContain('heater');
      expect(services.snapshot().auto.enabled).toBe(false);
    });

    it('drives the heater in Preheat once Settings say Auto, and tells the windows', async () => {
      const { clock, services, sim, published } = autoSetup();
      await services.settings.get();
      const sent = outputs(sim);
      await services.session.connect(sim, { kind: 'simulator' });
      await services.roast.act('preheat');
      await clock.runFor(5000);
      expect(sent()).toContain('heater');
      expect(services.snapshot().auto.preheatStep).not.toBeNull();
      expect(published.map(([c]) => c)).toContain(IPC_CHANNELS.autoStatus);
    });

    it('saves an Auto roast with its profile copy and soak, and the phase it ran', async () => {
      const { clock, services, sim, repository } = autoSetup();
      await services.settings.get();
      await services.session.connect(sim, { kind: 'simulator' });
      await services.roast.act('preheat');
      await clock.runFor(3000);
      await services.roast.act('start');
      await clock.runFor(3000);
      await services.recorder.flush();
      const saved = await repository.get(1);
      if (!saved.ok) throw new Error('not saved');
      expect(saved.value.mode).toBe('auto');
      expect(saved.value.profile?.phases[0]?.next).toEqual({ on: 'time', afterS: 45 });
      expect(saved.value.events.map((e) => [e.kind, e.detail])).toContainEqual(['phase', 'Soak']);
    });

    it('stops on emergency stop and never sends the heater again by itself', async () => {
      const { clock, services, sim } = autoSetup();
      await services.settings.get();
      await services.session.connect(sim, { kind: 'simulator' });
      await services.roast.act('preheat');
      await clock.runFor(3000);
      services.session.emergencyStop();
      await clock.runFor(1000);
      expect(services.snapshot().auto.stopped).toBe(true);
      const sent = outputs(sim);
      await clock.runFor(5000);
      expect(sent()).not.toContain('heater');
      expect(services.pilot.resume()).toEqual({ ok: false, error: { kind: 'safety-locked' } });
    });

    it('stops when the roaster is disconnected', async () => {
      const { clock, services, sim } = autoSetup();
      await services.settings.get();
      await services.session.connect(sim, { kind: 'simulator' });
      await services.roast.act('preheat');
      await clock.runFor(2000);
      await services.session.disconnect();
      expect(services.snapshot().auto.stopped).toBe(true);
    });
  });

  it('forgets the next roast ghost when that roast is deleted', async () => {
    const roasts = {
      ...unavailableRepository('x'),
      delete: () => Promise.resolve(ok(undefined)),
    };
    const { services, published } = setup(roasts);
    services.beans.setSetup({ beanId: null, batchG: null, ghostRoastId: 5 });
    await services.history.delete(4);
    expect(services.snapshot().setup.ghostRoastId).toBe(5);
    await services.history.delete(5);
    expect(services.snapshot().setup.ghostRoastId).toBeNull();
    expect(published).toContainEqual([IPC_CHANNELS.roastsChanged, { id: 5, deleted: true }]);
  });
});
