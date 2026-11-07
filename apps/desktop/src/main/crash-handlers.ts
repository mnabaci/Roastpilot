import { serializeError, type Logger } from '@roastpilot/core';

/** How long a crash waits for the roast in progress to save before exiting anyway. */
export const CRASH_SAVE_TIMEOUT_MS = 2000;

export interface CrashHandlerDeps {
  process: Pick<NodeJS.Process, 'on'>;
  logger: Logger;
  /** Safe stop and close the roaster; settles on its own. */
  stopRoaster: () => Promise<void>;
  /** Safe stop and lock the heater, without closing anything. */
  emergencyStop: () => void;
  /** Save the roast in progress (the quit path's save-roast step). */
  saveRoast: () => Promise<void> | void;
  flushLogs: () => Promise<void>;
  exit: (code: number) => void;
}

type SaveOutcome = 'saved' | 'timed-out';

/** Runs the save, but gives up after the limit so a broken database can't hang the exit. */
async function saveWithin(saveRoast: () => Promise<void> | void, ms: number): Promise<SaveOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SaveOutcome>((resolve) => {
    timer = setTimeout(() => {
      resolve('timed-out');
    }, ms);
  });
  try {
    const save = (async () => {
      await saveRoast();
      return 'saved' as const;
    })();
    return await Promise.race([save, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Anything unexpected in main is logged and ends in a safe stop (docs/spec/errors-and-logging.md).
 * An uncaught exception leaves main in an unknown state, so it also exits: safe stop first, then a
 * time-limited try at saving the roast in progress, then the logs. Each step's failure is logged
 * and the next still runs; the sketch's 10 s watchdog covers anything that goes wrong after that.
 */
export function installCrashHandlers({
  process,
  logger,
  stopRoaster,
  emergencyStop,
  saveRoast,
  flushLogs,
  exit,
}: CrashHandlerDeps): void {
  let exiting = false;
  const stopSaveAndExit = async () => {
    try {
      await stopRoaster();
    } catch (error) {
      logger.error('app.crash-stop-failed', { error: serializeError(error) });
    }
    try {
      const outcome = await saveWithin(saveRoast, CRASH_SAVE_TIMEOUT_MS);
      if (outcome === 'timed-out') {
        logger.error('app.crash-save-timed-out', { timeoutMs: CRASH_SAVE_TIMEOUT_MS });
      }
    } catch (error) {
      logger.error('app.crash-save-failed', { error: serializeError(error) });
    }
    try {
      await flushLogs();
    } catch (error) {
      // Best effort: the live and dev-terminal sinks may still carry it even if the file failed.
      logger.error('app.crash-flush-failed', { error: serializeError(error) });
    }
  };
  process.on('uncaughtException', (error) => {
    logger.error('app.uncaught-exception', { error: serializeError(error) });
    if (exiting) return;
    exiting = true;
    // Each step catches its own failure, and finally guarantees the exit.
    stopSaveAndExit()
      .finally(() => {
        exit(1);
      })
      .catch((exitError: unknown) => {
        logger.error('app.crash-exit-failed', { error: serializeError(exitError) });
      });
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('app.unhandled-rejection', { error: serializeError(reason) });
    emergencyStop();
  });
}
