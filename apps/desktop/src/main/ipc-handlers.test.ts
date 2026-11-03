import { createLogger, type RoasterDriver } from '@roastpilot/core';
import { IPC_CHANNELS, ok, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  createIpcHandlers,
  handleRendererLog,
  withErrorLogging,
  type IpcDeps,
} from './ipc-handlers';

function setup() {
  const calls: unknown[][] = [];
  const driver = {} as RoasterDriver;
  const deps: IpcDeps = {
    session: {
      connect: (d) => {
        calls.push(['connect', d]);
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
    listPorts: () => Promise.resolve([{ path: 'COM3' }]),
    createDriver: (target) => {
      calls.push(['createDriver', target]);
      return driver;
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
      ['connect', driver],
    ]);
  });

  it.each([
    [IPC_CHANNELS.connect, { kind: 'serial', path: '' }],
    [IPC_CHANNELS.connect, undefined],
    [IPC_CHANNELS.setOutput, { channel: 'heater', value: '100' }],
    [IPC_CHANNELS.setOutput, { channel: 'heater', value: Number.NaN }],
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
