import { serializeError, type Logger, type Updater, type UpdaterEvent } from '@roastpilot/core';
import { err, ok } from '@roastpilot/shared';

/** electron-updater's `autoUpdater`, narrowed to what Roastpilot uses (a fake in tests). */
export interface AppUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  logger: {
    info(message?: unknown): void;
    warn(message?: unknown): void;
    error(message?: unknown): void;
    debug?(message: string): void;
  } | null;
  checkForUpdates(): Promise<{ updateInfo: { version: string } } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'download-progress', listener: (info: { percent: number }) => void): unknown;
  on(event: 'update-downloaded', listener: (info: { version: string }) => void): unknown;
  removeListener(
    event: 'download-progress',
    listener: (info: { percent: number }) => void,
  ): unknown;
  removeListener(
    event: 'update-downloaded',
    listener: (info: { version: string }) => void,
  ): unknown;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Sets electron-updater up so it never acts on its own: `UpdateService` decides when to download
 * (Windows only) and when to install (docs/spec/install-and-update.md). Its own chatter goes to
 * the app log at debug level; its failures come back as results.
 */
export function adaptUpdater(
  updater: AppUpdaterLike,
  { canInstall, logger }: { canInstall: boolean; logger: Logger },
): Updater {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = canInstall;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  const say = (text: unknown) => {
    logger.debug('updater.message', { message: String(text) });
  };
  updater.logger = { info: say, warn: say, error: say, debug: say };
  // An EventEmitter without an `error` listener throws, which would reach the crash handler.
  // Every failure also rejects the call that caused it, and is logged there.
  updater.on('error', (error) => {
    logger.debug('updater.error-event', { error: serializeError(error) });
  });
  return {
    async latestVersion() {
      try {
        const result = await updater.checkForUpdates();
        return result ? ok(result.updateInfo.version) : err({ message: 'The updater is off.' });
      } catch (error) {
        return err({ message: message(error) });
      }
    },
    async download() {
      try {
        await updater.downloadUpdate();
        return ok(undefined);
      } catch (error) {
        return err({ message: message(error) });
      }
    },
    quitAndInstall() {
      // Silent, then start the new version: Restart to update is one click.
      updater.quitAndInstall(true, true);
    },
    onEvent(listener: (event: UpdaterEvent) => void) {
      const progress = (info: { percent: number }) => {
        listener({ kind: 'progress', percent: info.percent });
      };
      const downloaded = (info: { version: string }) => {
        listener({ kind: 'downloaded', version: info.version });
      };
      updater.on('download-progress', progress);
      updater.on('update-downloaded', downloaded);
      return () => {
        updater.removeListener('download-progress', progress);
        updater.removeListener('update-downloaded', downloaded);
      };
    },
  };
}
