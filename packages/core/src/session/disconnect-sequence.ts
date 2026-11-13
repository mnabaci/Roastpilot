import type { DriverError, Result } from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import type { RoasterDriver } from '../roaster-driver';

/** How long quit and disconnect wait for the safe stop before going on (docs/spec/architecture.md). */
export const SAFE_STOP_TIMEOUT_MS = 2_000;
/** How long disconnect waits for the port to close, so an adapter that never answers can't hold up quit. */
export const CLOSE_TIMEOUT_MS = 2_000;

/**
 * Sends outputs and remembers the ones not settled yet, so a disconnect's safe stop goes out after
 * them and heater 0 is the last command (docs/spec/safety.md). Every step of the stop has a time
 * limit, so a roaster or port that never answers can't hang quit.
 */
export class DisconnectSequence {
  readonly #clock: Clock;
  readonly #logger: Logger;
  readonly #outputsInFlight = new Set<Promise<unknown>>();

  constructor(clock: Clock, logger: Logger) {
    this.#clock = clock;
    this.#logger = logger;
  }

  async send(
    driver: RoasterDriver,
    channel: string,
    value: number,
  ): Promise<Result<void, DriverError>> {
    const sending = driver.setOutput(channel, value);
    this.#outputsInFlight.add(sending);
    try {
      return await sending;
    } finally {
      this.#outputsInFlight.delete(sending);
    }
  }

  /** Waits for the outputs already sent, then safe stop, then close; logs any step that ran out of time. */
  async stopAndClose(driver: RoasterDriver): Promise<void> {
    // An output sent before the disconnect could otherwise reach the roaster after the safe stop.
    const outputs = Promise.allSettled([...this.#outputsInFlight]);
    if (!(await this.#within(outputs, SAFE_STOP_TIMEOUT_MS)))
      this.#logger.warn('session.outputs-timed-out', { timeoutMs: SAFE_STOP_TIMEOUT_MS });
    if (!(await this.#within(driver.safeStop(), SAFE_STOP_TIMEOUT_MS)))
      this.#logger.warn('session.safe-stop-timed-out', { timeoutMs: SAFE_STOP_TIMEOUT_MS });
    if (!(await this.#within(driver.disconnect(), CLOSE_TIMEOUT_MS)))
      this.#logger.error('session.close-timed-out', { timeoutMs: CLOSE_TIMEOUT_MS });
  }

  /** Waits for `work`, but no longer than `ms` of clock time: true when it finished in time. */
  async #within(work: Promise<unknown>, ms: number): Promise<boolean> {
    const timedOut = this.#clock.delay(ms).then(() => false);
    return Promise.race([work.then(() => true), timedOut]);
  }
}
