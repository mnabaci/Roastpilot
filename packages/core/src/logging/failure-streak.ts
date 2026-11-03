import type { Result } from '@roastpilot/shared';
import type { Logger } from './logger';

/**
 * Logs a repeating failure once when it starts (or changes kind) and once when it ends, instead of
 * every second (docs/spec/errors-and-logging.md).
 */
export class FailureStreak {
  readonly #logger: Logger;
  readonly #event: string;
  #kind: string | undefined;
  #count = 0;

  constructor(logger: Logger, event: string) {
    this.#logger = logger;
    this.#event = event;
  }

  record(result: Result<unknown, { kind: string }>): void {
    if (result.ok) {
      if (this.#kind !== undefined)
        this.#logger.info(`${this.#event}-recovered`, { failures: this.#count });
      this.#kind = undefined;
      this.#count = 0;
      return;
    }
    this.#count++;
    if (result.error.kind !== this.#kind) {
      this.#kind = result.error.kind;
      this.#logger.warn(`${this.#event}-failed`, { error: result.error });
    }
  }
}
