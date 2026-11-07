import { IPC_CHANNELS } from '@roastpilot/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  windows: [] as { isDestroyed: () => boolean; webContents: unknown }[],
  handle: vi.fn(),
  on: vi.fn(),
}));

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => electron.windows },
  ipcMain: { handle: electron.handle, on: electron.on },
}));

const { broadcast, registerIpcHandlers, registerIpcListener } = await import('./ipc');

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

  it('registers each handler on its channel, passing only the payload', async () => {
    const handler = vi.fn(() => Promise.resolve('done'));
    registerIpcHandlers({ [IPC_CHANNELS.listPorts]: handler });
    expect(electron.handle).toHaveBeenCalledWith(IPC_CHANNELS.listPorts, expect.any(Function));
    const registered = electron.handle.mock.calls[0]?.[1] as (e: unknown, p: unknown) => unknown;
    await expect(registered({ sender: 'window' }, { x: 1 })).resolves.toBe('done');
    expect(handler).toHaveBeenCalledWith({ x: 1 });
  });

  it('registers a listener that gets only the payload', () => {
    const listener = vi.fn();
    registerIpcListener(IPC_CHANNELS.log, listener);
    const registered = electron.on.mock.calls[0]?.[1] as (e: unknown, p: unknown) => void;
    registered({ sender: 'window' }, 'entry');
    expect(listener).toHaveBeenCalledWith('entry');
  });
});
