import { serializeError, type Logger } from '@roastpilot/core';
import { pruneOldLogs } from './file-log-sink';

export const KEEP_LOG_DAYS = 7;

/** Deletes old log files in the background; never delays start-up. */
export function pruneOldLogsLater(dir: string, logger: Logger): void {
  pruneOldLogs(dir, new Date(), KEEP_LOG_DAYS)
    .then((deleted) => {
      if (deleted.length > 0) logger.info('logs.pruned', { deleted });
    })
    .catch((error: unknown) => {
      logger.warn('logs.prune-failed', { error: serializeError(error) });
    });
}
