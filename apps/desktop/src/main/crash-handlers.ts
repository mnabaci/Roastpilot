import { serializeError, type Logger } from '@roastpilot/core';

export interface CrashHandlerDeps {
  process: Pick<NodeJS.Process, 'on'>;
  logger: Logger;
  /** Safe stop and close the roaster; settles on its own. */
  stopRoaster: () => Promise<void>;
  /** Safe stop and lock the heater, without closing anything. */
  emergencyStop: () => void;
  flushLogs: () => Promise<void>;
  exit: (code: number) => void;
}

/**
 * Anything unexpected in main is logged and ends in a safe stop (docs/spec/errors-and-logging.md).
 * An uncaught exception leaves main in an unknown state, so it also exits; the sketch's 10 s
 * watchdog covers anything that goes wrong after that.
 */
export function installCrashHandlers({
  process,
  logger,
  stopRoaster,
  emergencyStop,
  flushLogs,
  exit,
}: CrashHandlerDeps): void {
  let exiting = false;
  process.on('uncaughtException', (error) => {
    logger.error('app.uncaught-exception', { error: serializeError(error) });
    if (exiting) return;
    exiting = true;
    stopRoaster()
      .catch((stopError: unknown) => {
        logger.error('app.crash-stop-failed', { error: serializeError(stopError) });
      })
      .finally(() => {
        flushLogs()
          .catch(() => undefined) // Nowhere left to report a failing log flush; we are exiting.
          .finally(() => {
            exit(1);
          });
      });
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('app.unhandled-rejection', { error: serializeError(reason) });
    emergencyStop();
  });
}
