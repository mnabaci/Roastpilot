import { serializeError, type Logger } from '@roastpilot/core';

/** One thing to do before quitting, named for the log. */
export interface QuitStep {
  name: string;
  /** Must settle on its own: quit waits for it. */
  run: () => Promise<void> | void;
}

export interface QuitGuardDeps {
  /** In order: safe stop first, then saving and closing, logs last. */
  steps: readonly QuitStep[];
  quit: () => void;
  logger: Logger;
}

/**
 * Handles Electron's before-quit: the first time, hold the quit, run every step in order, then quit
 * for real. A failing step is logged and the rest still run, so a roaster that won't answer never
 * keeps the roast from being saved. Later calls (our own quit, or the user pressing quit again)
 * pass straight through or wait.
 */
export function createQuitGuard({
  steps,
  quit,
  logger,
}: QuitGuardDeps): (event: { preventDefault: () => void }) => void {
  let stopped = false;
  let stopping = false;
  const runAll = async () => {
    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        // Go on anyway: for the roaster, the sketch's 10 s watchdog switches everything off.
        logger.error('app.quit-step-failed', { step: step.name, error: serializeError(error) });
      }
    }
  };
  return (event) => {
    if (stopped) return;
    event.preventDefault();
    if (stopping) return;
    stopping = true;
    logger.info('app.quitting');
    runAll()
      .finally(() => {
        stopped = true;
        quit();
      })
      .catch((error: unknown) => {
        logger.error('app.quit-failed', { error: serializeError(error) });
      });
  };
}
