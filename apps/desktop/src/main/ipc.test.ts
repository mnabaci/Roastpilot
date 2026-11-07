import { createLogger } from '@roastpilot/core';
import { IPC_CHANNELS, type LogEntry } from '@roastpilot/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  windows: [] as { isDestroyed: () => boolean; webContents: unknown }[],
  /** The window each sender's web contents belongs to. */
  owners: new Map<unknown, { isDestroyed: () => boolean }>(),
  handle: vi.fn(),
  on: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => electron.windows,
    fromWebContents: (contents: unknown) => electron.owners.get(contents) ?? null,
  },
  ipcMain: { handle: electron.handle, on: electron.on },
}));

const { broadcast, registerIpcHandlers, registerIpcListener, SenderRefusedError } =
  await import('./ipc');

const DEV = 'http://localhost:5173';
const APP_URL = `${DEV}/#/beans`;

/** A sender check that logs into `entries`, for the dev server's page. */
function check() {
  const entries: LogEntry[] = [];
  return {
    entries,
    check: {
      page: { devUrl: DEV, indexFile: '/app/index.html' },
      logger: createLogger({ write: (e) => entries.push(e) }, 'ipc'),
    },
  };
}

/** An event from a frame at `url`, in the app's window unless `ownWindow` is false. */
function eventFrom(url: string | null, { ownWindow = true } = {}) {
  const sender = {};
  const window = { isDestroyed: () => false };
  if (ownWindow) electron.owners.set(sender, window);
  return { window, event: { sender, senderFrame: url === null ? null : { url } } };
}

function fakeWindow({ closed = false, pageGone = false } = {}) {
  const send = vi.fn();
  return {
    send,
    win: {
      isDestroyed: () => closed,
      webContents: { isDestroyed: () => pageGone, send },
    },
  };
}

describe('ipc', () => {
  beforeEach(() => {
    electron.windows = [];
    electron.handle.mockReset();
    electron.on.mockReset();
    electron.owners.clear();
  });

  it('broadcast reaches every live window and skips closed ones or crashed pages', () => {
    const live = fakeWindow();
    const closed = fakeWindow({ closed: true });
    const crashed = fakeWindow({ pageGone: true });
    electron.windows = [live.win, closed.win, crashed.win];
    broadcast(IPC_CHANNELS.navigate, 'history');
    expect(live.send).toHaveBeenCalledWith(IPC_CHANNELS.navigate, 'history');
    expect(closed.send).not.toHaveBeenCalled();
    expect(crashed.send).not.toHaveBeenCalled();
  });

  it('registers each handler on its channel, passing the payload and the window that asked', async () => {
    const handler = vi.fn(() => Promise.resolve('done'));
    registerIpcHandlers({ [IPC_CHANNELS.listPorts]: handler }, check().check);
    expect(electron.handle).toHaveBeenCalledWith(IPC_CHANNELS.listPorts, expect.any(Function));
    const registered = electron.handle.mock.calls[0]?.[1] as (e: unknown, p: unknown) => unknown;
    const { event, window } = eventFrom(APP_URL);
    await expect(registered(event, { x: 1 })).resolves.toBe('done');
    expect(handler).toHaveBeenCalledWith({ x: 1 }, { window });
  });

  it('registers a listener that gets only the payload', () => {
    const listener = vi.fn();
    registerIpcListener(IPC_CHANNELS.log, listener, check().check);
    const registered = electron.on.mock.calls[0]?.[1] as (e: unknown, p: unknown) => void;
    registered(eventFrom(APP_URL).event, 'entry');
    expect(listener).toHaveBeenCalledWith('entry');
  });

  it.each([
    ['another site', eventFrom('https://evil.example/')],
    ['a look-alike port', eventFrom('http://localhost:51730/')],
    ['a frame that is gone', eventFrom(null)],
    ['web contents that are not an app window', eventFrom(APP_URL, { ownWindow: false })],
  ])('refuses a call from %s, runs nothing and logs it once', async (_what, { event }) => {
    const { entries, check: guard } = check();
    const handler = vi.fn(() => Promise.resolve('done'));
    registerIpcHandlers({ [IPC_CHANNELS.connect]: handler }, guard);
    const registered = electron.handle.mock.calls[0]?.[1] as (e: unknown, p: unknown) => unknown;
    await expect(registered(event, { kind: 'simulator' })).rejects.toBeInstanceOf(
      SenderRefusedError,
    );
    expect(handler).not.toHaveBeenCalled();
    expect(entries).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'ipc.sender-refused',
        context: expect.objectContaining({ channel: IPC_CHANNELS.connect }) as unknown,
      }),
    ]);
  });

  it('drops a message from a sender that is not the app, logged', () => {
    const { entries, check: guard } = check();
    const listener = vi.fn();
    registerIpcListener(IPC_CHANNELS.log, listener, guard);
    const registered = electron.on.mock.calls[0]?.[1] as (e: unknown, p: unknown) => void;
    registered(eventFrom('https://evil.example/').event, 'entry');
    expect(listener).not.toHaveBeenCalled();
    expect(entries.map((e) => e.event)).toEqual(['ipc.sender-refused']);
  });
});
