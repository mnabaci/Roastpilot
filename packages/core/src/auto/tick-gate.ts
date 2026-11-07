import type { Logger } from '../logging/logger';

/** A tick still running after this long is logged once: Auto can't drop while it waits. */
export const STUCK_TICK_MS = 5_000;

/**
 * Runs one tick at a time: a slow roaster skips a reading rather than queueing commands. A command
 * that never answers holds every later reading, so the log says so, once.
 */
export class TickGate {
  readonly #logger: Logger;
  /** When the running tick's reading came; undefined while none runs. */
  #busySinceMs: number | undefined;
  #stuckLogged = false;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  /** Runs `tick` for the reading at `atMs`, or skips it while the last one still runs. */
  async run(atMs: number, tick: () => Promise<void>): Promise<void> {
    if (this.#busySinceMs !== undefined) {
      const forMs = atMs - this.#busySinceMs;
      if (forMs >= STUCK_TICK_MS && !this.#stuckLogged) {
        this.#stuckLogged = true;
        this.#logger.error('auto.tick-stuck', { forMs });
      }
      return;
    }
    this.#busySinceMs = atMs;
    try {
      await tick();
    } finally {
      this.#busySinceMs = undefined;
      this.#stuckLogged = false;
    }
  }
}
