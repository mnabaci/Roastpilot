import type { Result } from '@roastpilot/shared';
import type { Logger } from './logger';

/**
 * Logs a repeating failure once when it starts (or changes kind) and once when it ends, instead of
 * every second (docs/spec/errors-and-logging.md).
 */
export class FailureStreak {
  readonly #logger: Logger;
  readonly #event: string;
  readonly #context: Readonly<Record<string, unknown>>;
  #kind: string | undefined;
  #count = 0;

  /** `context` goes on both entries, e.g. which port. */
  constructor(logger: Logger, event: string, context: Readonly<Record<string, unknown>> = {}) {
    this.#logger = logger;
    this.#event = event;
    this.#context = context;
  }

  record(result: Result<unknown, { kind: string }>): void {
    if (result.ok) {
      if (this.#kind !== undefined)
        this.#logger.info(`${this.#event}-recovered`, { ...this.#context, failures: this.#count });
      this.#kind = undefined;
      this.#count = 0;
      return;
    }
    this.#count++;
    if (result.error.kind !== this.#kind) {
      this.#kind = result.error.kind;
      this.#logger.warn(`${this.#event}-failed`, { ...this.#context, error: result.error });
    }
  }
}
