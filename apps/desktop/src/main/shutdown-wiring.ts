import type { Logger, RoasterSession, RoastRecorder } from '@roastpilot/core';
import { IPC_CHANNELS, isRoastRunning, type RoastState } from '@roastpilot/shared';
import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { installCrashHandlers } from './crash-handlers';
import { broadcast } from './ipc';
import { createQuitGuard } from './quit-guard';
import { systemClock } from './system-clock';
import { macEnvironment } from './updates/mac/mac-environment';
import { createUpdates, type Updates } from './updates/update-wiring';

/**
 * Quit, crash and Restart to update share one shutdown, in this order: safe stop first, then
 * saving, logs last (docs/spec/safety.md). Updates never touch a roast (ADRs 0017, 0018).
 */
export function wireShutdown({
  session,
  recorder,
  roastState,
  closeDatabase,
  flushLogs,
  logger,
}: {
  session: Pick<RoasterSession, 'disconnect' | 'emergencyStop'>;
  recorder: Pick<RoastRecorder, 'flush'>;
  roastState: () => RoastState;
  closeDatabase: () => void;
  flushLogs: () => Promise<void>;
  logger: Logger;
}): Updates {
  const stopRoaster = () => session.disconnect();
  const saveRoast = () => recorder.flush();
  installCrashHandlers({
    process,
    logger,
    stopRoaster,
    emergencyStop: () => {
      session.emergencyStop();
    },
    saveRoast,
    flushLogs,
    exit: (code) => {
      app.exit(code);
    },
  });
  const quitGuard = createQuitGuard({
    logger,
    steps: [
      { name: 'safe-stop', run: stopRoaster },
      { name: 'save-roast', run: saveRoast },
      { name: 'close-database', run: closeDatabase },
      // macOS: starts the installer once the app is shut down, if an update is ready (ADR 0018).
      // Before the logs are flushed, so a helper that won't start is in the log.
      {
        name: 'install-update',
        run: () => {
          updates.installOnQuit();
        },
      },
      { name: 'flush-logs', run: flushLogs },
    ],
    quit: () => {
      app.quit();
    },
  });
  app.on('before-quit', quitGuard);
  const updates = createUpdates({
    packaged: app.isPackaged,
    platform: process.platform,
    version: app.getVersion(),
    updater: () => electronUpdater.autoUpdater,
    clock: systemClock,
    wallNowMs: () => Date.now(),
    isRoasting: () => isRoastRunning(roastState()),
    publish: (status) => {
      broadcast(IPC_CHANNELS.updateStatus, status);
    },
    // Restart to update: the same shutdown as quitting, then the installer (docs/spec/safety.md).
    shutdownThen: (finish) => {
      quitGuard.shutdownThen(finish);
    },
    quit: () => {
      app.quit();
    },
    openExternal: (url) => shell.openExternal(url),
    mac: macEnvironment,
    logger: logger.child('updates'),
  });
  return updates;
}
