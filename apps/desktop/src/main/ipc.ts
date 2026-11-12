import type { Logger } from '@roastpilot/core';
import type { IpcEventChannel, IpcEventPayloads } from '@roastpilot/shared';
import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { AnyIpcHandler, IpcCaller } from './ipc-handlers';
import { isAppPage, type AppPage } from './window-navigation';

/** A call that didn't come from the app's own page in one of its windows: refused, never run. */
export class SenderRefusedError extends Error {
  readonly kind = 'sender-refused';
  readonly channel: string;

  constructor(channel: string) {
    super(`IPC call on ${channel} refused: it did not come from the app's own page`);
    this.name = 'SenderRefusedError';
    this.channel = channel;
  }
}

/** What a sender must be: a frame showing the app's page, in one of the app's windows. */
export interface SenderCheck {
  page: AppPage;
  logger: Logger;
}

/** The app window a call came from; undefined, logged once, when the sender isn't ours. */
function callerOf(
  event: IpcMainEvent | IpcMainInvokeEvent,
  channel: string,
  { page, logger }: SenderCheck,
): IpcCaller | undefined {
  const frame = event.senderFrame;
  const window = BrowserWindow.fromWebContents(event.sender);
  const ownWindow = window !== null && !window.isDestroyed();
  if (frame && ownWindow && isAppPage(frame.url, page)) return { window };
  logger.warn('ipc.sender-refused', { channel, url: frame?.url ?? null, ownWindow });
  return undefined;
}

/** Every invoke channel, each run only for calls from the app's own page (docs/spec/architecture.md). */
export function registerIpcHandlers(
  handlers: Readonly<Record<string, AnyIpcHandler>>,
  check: SenderCheck,
): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, payload: unknown) => {
      const caller = callerOf(event, channel, check);
      if (!caller) return Promise.reject(new SenderRefusedError(channel));
      return handler(payload, caller);
    });
  }
}

/** Fire-and-forget messages from the renderer (its log); one from any other sender is dropped. */
export function registerIpcListener(
  channel: string,
  listener: (payload: unknown) => void,
  check: SenderCheck,
): void {
  ipcMain.on(channel, (event, payload: unknown) => {
    if (callerOf(event, channel, check)) listener(payload);
  });
}

/**
 * Sends an event to every open window. A window closing, or one whose page has crashed, is skipped:
 * sending to it would throw into the roaster loop that published the event.
 */
export function broadcast<C extends IpcEventChannel>(
  channel: C,
  payload: IpcEventPayloads[C],
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed())
      win.webContents.send(channel, payload);
  }
}
