import { ManualClock, silentLogger, type SettingsStore } from '@roastpilot/core';
import { SimulatedDriver } from '@roastpilot/drivers';
import { DEFAULT_SETTINGS, IPC_CHANNELS, ok } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { createAppServices } from './app-services';

function setup() {
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
});
