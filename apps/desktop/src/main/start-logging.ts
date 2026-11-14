import { IPC_CHANNELS } from '@roastpilot/shared';
import { app, shell } from 'electron';
import { broadcast } from './ipc';
import { createAppLogger } from './logging/app-logger';
import { pruneOldLogsLater } from './logging/prune';
import { userDataChoice } from './user-data-override';

/**
 * The app's log, first thing (docs/spec/errors-and-logging.md): the daily file, the dev terminal
 * and the live viewer, with what started and where its data lives.
 */
export function startLogging() {
  const logDir = app.getPath('logs');
  const logs = createAppLogger({
    dir: logDir,
    dev: !app.isPackaged,
    publish: (records) => {
      broadcast(IPC_CHANNELS.logEntries, records);
    },
  });
  const { logger } = logs;
  logger.info('app.started', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  });
  if (userDataChoice.kind === 'override') {
    logger.info('app.user-data-override', { dir: userDataChoice.dir });
  } else if (userDataChoice.kind === 'ignored') {
    logger.warn('app.user-data-override-ignored', {
      reason: userDataChoice.reason,
      value: userDataChoice.value,
    });
  }
  pruneOldLogsLater(logDir, logger);
  const openLogFolder = async (): Promise<void> => {
    // openPath resolves with an error message, or '' when it worked.
    const failure = await shell.openPath(logDir);
    if (failure) throw new Error(`Couldn't open the log folder: ${failure}`);
  };
  return { logger, flush: () => logs.flush(), logDir, openLogFolder };
}
