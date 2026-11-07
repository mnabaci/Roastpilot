import type { DriverError, Result } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';

/**
 * Heater 0 that must land: when Auto gives up the heater (Drop, a preheat limit, its own failure),
 * a failed write is tried again on every reading until the roaster takes it, or you set the heater
 * yourself (docs/spec/safety.md, Auto mode).
 */
export class HeaterCut {
  readonly #setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  readonly #logger: Logger;
  #pending: string | undefined;

  constructor(
    setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>,
    logger: Logger,
  ) {
    this.#setOutput = setOutput;
    this.#logger = logger;
  }

  /** True until a heater 0 for the last `cut` has landed. */
  get pending(): boolean {
    return this.#pending !== undefined;
  }

  /** Heater 0 now, and again on every `retry` until it lands. Never rejects. */
  async cut(reason: string): Promise<void> {
    this.#pending = reason;
    await this.#send(reason);
  }

  /** Every reading: tries a cut that hasn't landed yet once more. */
  async retry(): Promise<void> {
    if (this.#pending !== undefined) await this.#send(this.#pending);
  }

  /** You set the heater yourself: it is yours, and nothing is sent over it. */
  forget(): void {
    this.#pending = undefined;
  }

  async #send(reason: string): Promise<void> {
    try {
      const sent = await this.#setOutput('heater', 0);
      if (sent.ok) {
        // A `forget` or a newer cut while this one was on its way has the last word.
        if (this.#pending === reason) this.#pending = undefined;
        return;
      }
      this.#logger.warn('auto.heater-cut-failed', { reason, error: sent.error });
    } catch (error) {
      this.#logger.error('auto.heater-cut-failed', { reason, error: serializeError(error) });
    }
  }
}
