import type { DriverError, OutputOwner, Result } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';

export type DrivenOutput = 'heater' | 'fan';

export const isDriven = (channel: string): channel is DrivenOutput =>
  channel === 'heater' || channel === 'fan';

/** Who owns heater and fan, and what Auto last sent them. */
export class AutoOutputs {
  readonly #setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  readonly #round: (channel: string, value: number) => number;
  readonly #logger: Logger;
  #owners: Record<DrivenOutput, OutputOwner> = { heater: 'auto', fan: 'auto' };
  #sent: Partial<Record<DrivenOutput, number>> = {};

  constructor(
    setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>,
    round: (channel: string, value: number) => number,
    logger: Logger,
  ) {
    this.#setOutput = setOutput;
    this.#round = round;
    this.#logger = logger;
  }

  owner(channel: DrivenOutput): OutputOwner {
    return this.#owners[channel];
  }

  takeOver(channel: DrivenOutput): void {
    this.#owners[channel] = 'manual';
  }

  /** Back to Auto, which sends both again. */
  handBack(): void {
    this.#owners = { heater: 'auto', fan: 'auto' };
    this.forgetSent();
  }

  forgetSent(): void {
    this.#sent = {};
  }

  /** Sends only your-roaster-sized changes; a failed command is tried again on the next tick. */
  async send(channel: DrivenOutput, value: number): Promise<void> {
    if (this.#owners[channel] !== 'auto') return;
    const rounded = this.#round(channel, value);
    if (this.#sent[channel] === rounded) return;
    const result = await this.#setOutput(channel, rounded);
    if (result.ok) this.#sent[channel] = rounded;
    else this.#logger.warn('auto.output-failed', { channel, value: rounded, error: result.error });
  }
}
