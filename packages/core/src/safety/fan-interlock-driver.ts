import type { Channel, DriverError, Reading, Result } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import type { RoasterDriver } from '../roaster-driver';

const HEATER = 'heater';
const FAN = 'fan';

/**
 * "Minimum fan while heating" (docs/spec/safety.md): for air roasters, whose heater burns out with
 * too little air. While the heater is above 0 the fan is never below `minFanPct`: a heater command
 * raises the fan first, and a lower fan is held at the minimum. Logged once per hold; not a trip.
 */
export class FanInterlockDriver implements RoasterDriver {
  readonly #inner: RoasterDriver;
  readonly #minFanPct: number;
  readonly #logger: Logger;
  #heater = 0;
  #fan = 0;
  #holding = false;

  constructor(inner: RoasterDriver, minFanPct: number, logger: Logger) {
    this.#inner = inner;
    this.#minFanPct = minFanPct;
    this.#logger = logger;
  }

  get channels(): readonly Channel[] {
    return this.#inner.channels;
  }

  async connect(): Promise<Result<void, DriverError>> {
    // What the board runs now is unknown until we set it: assume off, so the first heater
    // command raises the fan.
    this.#heater = 0;
    this.#fan = 0;
    this.#holding = false;
    return this.#inner.connect();
  }

  read(): Promise<Result<Reading, DriverError>> {
    return this.#inner.read();
  }

  async setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    if (channel === HEATER) return this.#setHeater(value);
    if (channel === FAN) return this.#setFan(value);
    return this.#inner.setOutput(channel, value);
  }

  async safeStop(): Promise<void> {
    await this.#inner.safeStop();
    this.#heater = 0;
    this.#holding = false;
  }

  disconnect(): Promise<void> {
    return this.#inner.disconnect();
  }

  async #setHeater(value: number): Promise<Result<void, DriverError>> {
    if (value > 0 && this.#fan < this.#minFanPct) {
      this.#hold(this.#fan);
      const raised = await this.#inner.setOutput(FAN, this.#minFanPct);
      // No air, no heat: a fan that didn't take the minimum keeps the heater off.
      if (!raised.ok) return raised;
      this.#fan = this.#minFanPct;
    }
    const sent = await this.#inner.setOutput(HEATER, value);
    if (sent.ok) {
      this.#heater = value;
      if (value <= 0) this.#holding = false;
    }
    return sent;
  }

  async #setFan(value: number): Promise<Result<void, DriverError>> {
    const held = this.#heater > 0 && value < this.#minFanPct;
    if (held) this.#hold(value);
    const fan = held ? this.#minFanPct : value;
    const sent = await this.#inner.setOutput(FAN, fan);
    if (sent.ok) this.#fan = fan;
    return sent;
  }

  #hold(requested: number): void {
    if (this.#holding) return;
    this.#holding = true;
    this.#logger.info('safety.fan-held-for-heater', { requested, held: this.#minFanPct });
  }
}
