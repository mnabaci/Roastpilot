import { createLogger, type RoasterDriver } from '@roastpilot/core';
import { BUILT_IN_ROASTERS, SKYWALKER_PROFILES } from '@roastpilot/drivers';
import {
  AUTO_OFF,
  NO_ROAST_SETUP,
  DEFAULT_SETTINGS,
  err,
  IPC_CHANNELS,
  ok,
  READY_ROAST,
  type LogEntry,
  type Snapshot,
} from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  createIpcHandlers,
  handleRendererLog,
  withErrorLogging,
  type IpcDeps,
} from './ipc-handlers';

const SNAPSHOT: Snapshot = {
  connection: { status: 'disconnected' },
  roast: READY_ROAST,
  readings: [],
  safety: { locked: false, tripped: [] },
  auto: AUTO_OFF,
  setup: NO_ROAST_SETUP,
  currentRoastId: null,
};

function setup() {
  const calls: unknown[][] = [];
  const driver = {} as RoasterDriver;
  const deps: IpcDeps = {
    session: {
      connect: (d, target) => {
        calls.push(['connect', d, target]);
        return Promise.resolve(ok(undefined));
      },
      disconnect: () => {
        calls.push(['disconnect']);
        return Promise.resolve();
      },
      setOutput: (channel, value) => {
        calls.push(['setOutput', channel, value]);
        return Promise.resolve(ok(undefined));
      },
      emergencyStop: () => calls.push(['emergencyStop']),
      acknowledgeSafety: () => ok(undefined),
    },
    roast: {
      act: (action) => {
        calls.push(['roast', action]);
        return Promise.resolve(ok(undefined));
      },
      outputRequested: (channel, value) => calls.push(['outputRequested', channel, value]),
    },
    settings: {
      get: () => Promise.resolve(DEFAULT_SETTINGS),
      set: (next) => {
        calls.push(['settings', next]);
        return Promise.resolve(ok(DEFAULT_SETTINGS));
      },
    },
    history: {
      list: () => Promise.resolve([]),
      get: (id) => {
        calls.push(['getRoast', id]);
        return Promise.resolve(err({ kind: 'not-found', id }));
      },
      delete: (id) => {
        calls.push(['deleteRoast', id]);
        return Promise.resolve(ok(undefined));
      },
      saveResult: (result) => {
        calls.push(['saveResult', result.id]);
        return Promise.resolve(ok(undefined));
      },
    },
    pilot: {
      chargeSoon: (nowMs) => {
        calls.push(['chargeSoon', nowMs]);
        return ok(undefined);
      },
      outputRequested: (channel, value) => calls.push(['pilotOutput', channel, value]),
      resume: () => {
        calls.push(['resume']);
        return err({ kind: 'safety-locked' });
      },
    },
    beans: {
      list: () => Promise.resolve([]),
      add: (fields) => {
        calls.push(['addBean', fields.name]);
        return Promise.resolve(ok(1));
      },
      update: (update) => {
        calls.push(['updateBean', update.id]);
        return Promise.resolve(ok(undefined));
      },
      setArchived: (request) => {
        calls.push(['archive', request]);
        return Promise.resolve(ok(undefined));
      },
      addStock: (stock) => {
        calls.push(['addStock', stock.grams]);
        return Promise.resolve(ok(undefined));
      },
      adjustStock: (stock) => {
        calls.push(['adjustStock', stock.greenG]);
        return Promise.resolve(ok(undefined));
      },
      setSetup: (setup) => {
        calls.push(['setup', setup]);
      },
    },
    makeProfile: (request) => {
      calls.push(['makeProfile', request]);
      return Promise.resolve(err({ kind: 'too-short' }));
    },
    roasters: {
      load: () => Promise.resolve([]),
      add: (r) => {
        calls.push(['addRoaster', r]);
        return Promise.resolve(err({ kind: 'in-use' }));
      },
      save: (r) => {
        calls.push(['saveRoaster', r.id]);
        return Promise.resolve(err({ kind: 'in-use' }));
      },
      delete: (id) => {
        calls.push(['deleteRoaster', id]);
        return Promise.resolve(err({ kind: 'active' }));
      },
      setActive: (id) => {
        calls.push(['setActive', id]);
        return Promise.resolve(ok(undefined));
      },
      chooseConnection: (target) => {
        calls.push(['choose', target]);
        return Promise.resolve(ok(undefined));
      },
    },
    profiles: {
      copyTo: (id, roasterId) => {
        calls.push(['copy', id, roasterId]);
        return Promise.resolve(err({ kind: 'not-found', id }));
      },
      list: () => Promise.resolve([]),
      duplicate: (id) => {
        calls.push(['duplicate', id]);
        return Promise.resolve(err({ kind: 'not-found', id }));
      },
      save: (profile) => {
        calls.push(['save', profile.id]);
        return Promise.resolve(err({ kind: 'built-in', id: profile.id }));
      },
      delete: (id) => {
        calls.push(['delete', id]);
        return Promise.resolve(ok(undefined));
      },
    },
    nowMs: () => 42,
    snapshot: () => SNAPSHOT,
    listPorts: () => Promise.resolve([{ path: 'COM3' }]),
    createDriver: (target) => {
      calls.push(['createDriver', target]);
      return driver;
    },
    logs: {
      listDays: () => Promise.resolve(['2026-11-03']),
      readDay: (day) => {
        calls.push(['readDay', day]);
        return Promise.resolve({ records: [], unreadable: 0, truncated: false });
      },
      openFolder: () => {
        calls.push(['openFolder']);
        return Promise.resolve();
      },
    },
  };
  return { handlers: createIpcHandlers(deps), calls, driver };
}

const handle = (
  handlers: ReturnType<typeof createIpcHandlers>,
  channel: string,
  payload?: unknown,
) => {
  const handler = handlers[channel];
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler(payload);
};

describe('createIpcHandlers', () => {
  it('has a handler for every invoke channel', () => {
    const { handlers } = setup();
    expect(Object.keys(handlers).sort()).toEqual(
      [
        IPC_CHANNELS.listPorts,
        IPC_CHANNELS.connect,
        IPC_CHANNELS.disconnect,
        IPC_CHANNELS.setOutput,
        IPC_CHANNELS.emergencyStop,
        IPC_CHANNELS.acknowledgeSafety,
        IPC_CHANNELS.getSnapshot,
        IPC_CHANNELS.roastAction,
        IPC_CHANNELS.getSettings,
        IPC_CHANNELS.setSettings,
        IPC_CHANNELS.listLogDays,
        IPC_CHANNELS.readLogDay,
        IPC_CHANNELS.openLogFolder,
        IPC_CHANNELS.listRoasts,
        IPC_CHANNELS.getRoast,
        IPC_CHANNELS.deleteRoast,
        IPC_CHANNELS.autoChargeSoon,
        IPC_CHANNELS.autoResume,
        IPC_CHANNELS.listProfiles,
        IPC_CHANNELS.duplicateProfile,
        IPC_CHANNELS.saveProfile,
        IPC_CHANNELS.deleteProfile,
        IPC_CHANNELS.copyProfile,
        IPC_CHANNELS.listRoasters,
        IPC_CHANNELS.addRoaster,
        IPC_CHANNELS.saveRoaster,
        IPC_CHANNELS.deleteRoaster,
        IPC_CHANNELS.setActiveRoaster,
        IPC_CHANNELS.chooseConnection,
        IPC_CHANNELS.listBeans,
        IPC_CHANNELS.addBean,
        IPC_CHANNELS.updateBean,
        IPC_CHANNELS.setBeanArchived,
        IPC_CHANNELS.addStock,
        IPC_CHANNELS.adjustStock,
        IPC_CHANNELS.setRoastSetup,
        IPC_CHANNELS.saveRoastResult,
        IPC_CHANNELS.makeProfileFromRoast,
      ].sort(),
    );
  });

  it('builds the driver for a valid target and connects it', async () => {
    const { handlers, calls, driver } = setup();
    expect(await handle(handlers, IPC_CHANNELS.connect, { kind: 'simulator' })).toEqual(
      ok(undefined),
    );
    expect(calls).toEqual([
      ['createDriver', { kind: 'simulator' }],
      ['connect', driver, { kind: 'simulator' }],
    ]);
  });

  it.each([
    [IPC_CHANNELS.connect, { kind: 'serial', path: '' }],
    [IPC_CHANNELS.connect, undefined],
    [IPC_CHANNELS.setOutput, { channel: 'heater', value: '100' }],
    [IPC_CHANNELS.setOutput, { channel: 'heater', value: Number.NaN }],
    [IPC_CHANNELS.roastAction, 'charge-now'],
    [IPC_CHANNELS.roastAction, undefined],
    [IPC_CHANNELS.setSettings, 'full'],
    [IPC_CHANNELS.readLogDay, '../../etc/passwd'],
    [IPC_CHANNELS.readLogDay, undefined],
  ])('rejects a bad %s payload %j without touching the roaster', async (channel, payload) => {
    const { handlers, calls } = setup();
    await expect(handle(handlers, channel, payload)).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('passes a valid output through, telling the roast first (the heater ends a cool-down)', async () => {
    const { handlers, calls } = setup();
    await handle(handlers, IPC_CHANNELS.setOutput, { channel: 'fan', value: 40 });
    expect(calls).toEqual([
      ['outputRequested', 'fan', 40],
      ['pilotOutput', 'fan', 40],
      ['setOutput', 'fan', 40],
    ]);
  });
});

describe('roast, snapshot and settings handlers', () => {
  it('tells Auto about your output too, so it stays yours until Resume auto', async () => {
    const { handlers, calls } = setup();
    await handlers[IPC_CHANNELS.setOutput]?.({ channel: 'heater', value: 50 });
    expect(calls).toContainEqual(['pilotOutput', 'heater', 50]);
  });

  it('checks roaster requests at the boundary', async () => {
    const { handlers, calls } = setup();
    const roaster = BUILT_IN_ROASTERS[0];
    await expect(
      handlers[IPC_CHANNELS.saveRoaster]?.({ ...roaster, maxTempC: 500 }),
    ).rejects.toThrow();
    await expect(
      handlers[IPC_CHANNELS.addRoaster]?.({ name: '', model: 'skywalker' }),
    ).rejects.toThrow();
    await expect(handlers[IPC_CHANNELS.setActiveRoaster]?.(-1)).rejects.toThrow();
    await expect(handlers[IPC_CHANNELS.chooseConnection]?.({ kind: 'wifi' })).rejects.toThrow();
    expect(calls).toEqual([]);
    await handlers[IPC_CHANNELS.saveRoaster]?.(roaster);
    await handlers[IPC_CHANNELS.setActiveRoaster]?.(2);
    await handlers[IPC_CHANNELS.copyProfile]?.({ id: 'custom-1', roasterId: 2 });
    expect(calls).toEqual([
      ['saveRoaster', 1],
      ['setActive', 2],
      ['copy', 'custom-1', 2],
    ]);
  });

  it('checks bean requests at the boundary', async () => {
    const { handlers, calls } = setup();
    await expect(handlers[IPC_CHANNELS.addBean]?.({ name: '' })).rejects.toThrow();
    await expect(handlers[IPC_CHANNELS.addStock]?.({ beanId: 1, grams: -5 })).rejects.toThrow();
    await expect(handlers[IPC_CHANNELS.setRoastSetup]?.({ beanId: 'x' })).rejects.toThrow();
    await expect(handlers[IPC_CHANNELS.saveRoastResult]?.({ id: 1, rating: 9 })).rejects.toThrow();
    await expect(
      handlers[IPC_CHANNELS.makeProfileFromRoast]?.({ roastId: 1, style: 'wavy' }),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
    const setup_ = { beanId: 1, batchG: 375, ghostRoastId: null };
    await handlers[IPC_CHANNELS.setRoastSetup]?.(setup_);
    await handlers[IPC_CHANNELS.setBeanArchived]?.({ id: 1, archived: true });
    const adjust = { beanId: 1, greenG: 5, roastedG: 6 };
    await handlers[IPC_CHANNELS.adjustStock]?.(adjust);
    const made = { roastId: 1, style: 'curve' };
    await handlers[IPC_CHANNELS.makeProfileFromRoast]?.(made);
    expect(calls).toEqual([
      ['setup', setup_],
      ['archive', { id: 1, archived: true }],
      ['adjustStock', 5],
      ['makeProfile', made],
    ]);
  });

  it('passes Charge soon and Resume auto on', async () => {
    const { handlers, calls } = setup();
    await handlers[IPC_CHANNELS.autoChargeSoon]?.(undefined);
    expect(await handlers[IPC_CHANNELS.autoResume]?.(undefined)).toEqual(
      err({ kind: 'safety-locked' }),
    );
    expect(calls).toEqual([['chargeSoon', 42], ['resume']]);
  });

  it('checks a profile at the boundary before saving it', async () => {
    const { handlers, calls } = setup();
    await expect(
      handlers[IPC_CHANNELS.saveProfile]?.({ ...SKYWALKER_PROFILES['light-steps'], capC: 500 }),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
    await handlers[IPC_CHANNELS.saveProfile]?.(SKYWALKER_PROFILES['light-steps']);
    await handlers[IPC_CHANNELS.duplicateProfile]?.('light-curve');
    await handlers[IPC_CHANNELS.deleteProfile]?.('custom-1');
    expect(calls).toEqual([
      ['save', 'light-steps'],
      ['duplicate', 'light-curve'],
      ['delete', 'custom-1'],
    ]);
    await expect(handlers[IPC_CHANNELS.deleteProfile]?.('')).rejects.toThrow();
  });

  it('passes a valid roast action on', async () => {
    const { handlers, calls } = setup();
    expect(await handle(handlers, IPC_CHANNELS.roastAction, 'first-crack')).toEqual(ok(undefined));
    expect(calls).toEqual([['roast', 'first-crack']]);
  });

  it('returns the snapshot and the settings', async () => {
    const { handlers } = setup();
    expect(await handle(handlers, IPC_CHANNELS.getSnapshot)).toEqual(SNAPSHOT);
    expect(await handle(handlers, IPC_CHANNELS.getSettings)).toEqual(DEFAULT_SETTINGS);
  });

  it('cleans settings at the boundary before the service saves them', async () => {
    const { handlers, calls } = setup();
    await handle(handlers, IPC_CHANNELS.setSettings, {
      controls: 'full',
      extra: 1,
      connection: { kind: 'wifi' },
    });
    expect(calls).toEqual([['settings', { ...DEFAULT_SETTINGS, controls: 'full' }]]);
  });
});

describe('withErrorLogging', () => {
  it('logs a failing handler with its channel, then rethrows', async () => {
    const entries: LogEntry[] = [];
    const wrapped = withErrorLogging(
      { 'x:y': () => Promise.reject(new Error('bad')) },
      createLogger({ write: (e) => entries.push(e) }, 'ipc'),
    );
    await expect(handle(wrapped, 'x:y')).rejects.toThrow('bad');
    expect(entries.map((e) => [e.level, e.event, e.context?.channel])).toEqual([
      ['error', 'ipc.handler-failed', 'x:y'],
    ]);
  });

  it('passes results through untouched', async () => {
    const wrapped = withErrorLogging(
      { 'x:y': () => Promise.resolve(42) },
      createLogger({ write: () => undefined }, 'ipc'),
    );
    expect(await handle(wrapped, 'x:y')).toBe(42);
  });
});

describe('handleRendererLog', () => {
  const capture = () => {
    const entries: LogEntry[] = [];
    return { entries, logger: createLogger({ write: (e) => entries.push(e) }, 'renderer') };
  };

  it('writes a valid entry at its level under the renderer scope', () => {
    const { entries, logger } = capture();
    handleRendererLog(
      { level: 'error', event: 'renderer.uncaught-error', context: { message: 'x' } },
      logger,
    );
    expect(entries).toEqual([
      {
        level: 'error',
        scope: 'renderer',
        event: 'renderer.uncaught-error',
        context: { message: 'x' },
      },
    ]);
  });

  it.each([{ level: 'panic', event: 'x' }, { level: 'info' }, 'hello', null])(
    'logs a bad entry %j as a warning instead',
    (payload) => {
      const { entries, logger } = capture();
      handleRendererLog(payload, logger);
      expect(entries).toEqual([
        expect.objectContaining({ level: 'warn', event: 'ipc.bad-renderer-log' }),
      ]);
    },
  );
});

describe('log viewer handlers', () => {
  it('lists days, reads a valid day and opens the folder', async () => {
    const { handlers, calls } = setup();
    expect(await handle(handlers, IPC_CHANNELS.listLogDays)).toEqual(['2026-11-03']);
    await handle(handlers, IPC_CHANNELS.readLogDay, '2026-11-03');
    await handle(handlers, IPC_CHANNELS.openLogFolder);
    expect(calls).toEqual([['readDay', '2026-11-03'], ['openFolder']]);
  });
});

describe('history handlers', () => {
  it('lists roasts, and gets or deletes one by a valid id', async () => {
    const { handlers, calls } = setup();
    expect(await handle(handlers, IPC_CHANNELS.listRoasts)).toEqual([]);
    await handle(handlers, IPC_CHANNELS.getRoast, 3);
    await handle(handlers, IPC_CHANNELS.deleteRoast, 3);
    expect(calls).toEqual([
      ['getRoast', 3],
      ['deleteRoast', 3],
    ]);
  });

  it.each([0, -1, 1.5, '3', null])('rejects roast id %o and touches nothing', async (id) => {
    const { handlers, calls } = setup();
    await expect(handle(handlers, IPC_CHANNELS.deleteRoast, id)).rejects.toThrow();
    await expect(handle(handlers, IPC_CHANNELS.getRoast, id)).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
