import type { IpcEventChannel, IpcEventPayloads } from '@roastpilot/shared';
import { BrowserWindow, ipcMain } from 'electron';
import type { IpcHandler } from './ipc-handlers';

export function registerIpcHandlers(handlers: Record<string, IpcHandler>): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (_event, payload: unknown) => handler(payload));
  }
}

/** Fire-and-forget messages from the renderer (its log). */
export function registerIpcListener(channel: string, listener: (payload: unknown) => void): void {
  ipcMain.on(channel, (_event, payload: unknown) => {
    listener(payload);
  });
}

/** Sends an event to every open window. */
export function broadcast<C extends IpcEventChannel>(
  channel: C,
  payload: IpcEventPayloads[C],
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
