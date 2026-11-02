import { serializeError, type Logger } from '@roastpilot/core';

export interface QuitGuardDeps {
  /** Safe stop and close the roaster, then flush logs; must settle on its own. */
  stop: () => Promise<void>;
  quit: () => void;
  logger: Logger;
}

/**
 * Handles Electron's before-quit: the first time, hold the quit, safe-stop the roaster, then quit
 * for real. Later calls (our own quit, or the user pressing quit again) pass straight through or wait.
 */
export function createQuitGuard({
  stop,
  quit,
  logger,
}: QuitGuardDeps): (event: { preventDefault: () => void }) => void {
  let stopped = false;
  let stopping = false;
  return (event) => {
    if (stopped) return;
    event.preventDefault();
    if (stopping) return;
    stopping = true;
    logger.info('app.quitting');
    stop()
      .catch((error: unknown) => {
        // Quit anyway: the sketch's 10 s watchdog switches everything off.
        logger.error('app.quit-stop-failed', { error: serializeError(error) });
      })
      .finally(() => {
        stopped = true;
        quit();
      });
  };
}
