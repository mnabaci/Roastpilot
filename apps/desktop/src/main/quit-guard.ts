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

/** Electron's before-quit handler, plus the same shutdown ending in something other than quit. */
export interface QuitGuard {
  (event: { preventDefault: () => void }): void;
  /**
   * Runs the steps (once, as a quit would), then `finish` instead of quitting; after that a quit
   * passes straight through. Restart to update uses it: the installer starts only after the safe
   * stop.
   */
  shutdownThen(finish: () => void): void;
}

/**
 * Handles Electron's before-quit: the first time, hold the quit, run every step in order, then quit
 * for real. A failing step is logged and the rest still run, so a roaster that won't answer never
 * keeps the roast from being saved. Later calls (our own quit, or the user pressing quit again)
 * pass straight through or wait.
 */
export function createQuitGuard({ steps, quit, logger }: QuitGuardDeps): QuitGuard {
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
  let finish = quit;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    logger.info('app.quitting');
    runAll()
      .finally(() => {
        stopped = true;
        finish();
      })
      .catch((error: unknown) => {
        logger.error('app.quit-failed', { error: serializeError(error) });
      });
  };
  const guard: QuitGuard = Object.assign(
    (event: { preventDefault: () => void }) => {
      if (stopped) return;
      event.preventDefault();
      shutdown();
    },
    {
      shutdownThen(next: () => void) {
        // A quit already under way wins: it ends in quit, and the installer runs on quit anyway.
        if (stopping) return;
        finish = next;
        shutdown();
      },
    },
  );
  return guard;
}
