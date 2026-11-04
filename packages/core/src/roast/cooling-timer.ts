import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';

/** The one pending end of bean cooling: scheduling again or cancelling stands the old one down. */
export class CoolingTimer {
  readonly #clock: Clock;
  readonly #logger: Logger;
  #run = 0;

  constructor(clock: Clock, logger: Logger) {
    this.#clock = clock;
    this.#logger = logger;
  }

  /** Calls `onEnd` at `endsAtMs` (at once if that has passed), unless rescheduled or cancelled. */
  schedule(endsAtMs: number, onEnd: () => Promise<void>): void {
    const run = ++this.#run;
    this.#clock
      .delay(Math.max(0, endsAtMs - this.#clock.now()))
      .then(() => (run === this.#run ? onEnd() : undefined))
      .catch((error: unknown) => {
        this.#logger.error('roast.cooling-timer-failed', { error: serializeError(error) });
      });
  }

  cancel(): void {
    this.#run++;
  }
}
