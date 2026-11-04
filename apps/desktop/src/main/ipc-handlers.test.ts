import { createLogger, type RoasterDriver } from '@roastpilot/core';
import {
  DEFAULT_SETTINGS,
  err,
  IPC_CHANNELS,
  ok,
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
  roast: {
    phase: 'ready',
    preheatAtMs: null,
    chargedAtMs: null,
    firstCrackAtMs: null,
    droppedAtMs: null,
    coolingEndsAtMs: null,
    events: [],
  },
  readings: [],
  safety: { locked: false, tripped: [] },
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
    },
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

  it('passes a valid output through', async () => {
    const { handlers, calls } = setup();
    await handle(handlers, IPC_CHANNELS.setOutput, { channel: 'fan', value: 40 });
    expect(calls).toEqual([['setOutput', 'fan', 40]]);
  });
});

describe('roast, snapshot and settings handlers', () => {
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
    expect(calls).toEqual([
      ['settings', { controls: 'full', connection: null, chartSmoothingS: 5 }],
    ]);
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
