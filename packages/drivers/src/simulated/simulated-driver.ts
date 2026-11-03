import { quantize, type Clock, type DriverError, type RoasterDriver } from '@roastpilot/core';
import {
  err,
  ok,
  type Channel,
  type OutputChannel,
  type Reading,
  type Result,
} from '@roastpilot/shared';
import {
  SKYWALKER_CHANNELS,
  SKYWALKER_ESTOP_C,
  SKYWALKER_PROTOCOL_VERSION,
  SKYWALKER_SAFE_STOP,
  SKYWALKER_WATCHDOG_MS,
} from '../skywalker';
import { DEFAULT_THERMAL_CONSTANTS, stepTemperature, type ThermalConstants } from './thermal-model';

const STEP_MS = 100;

export interface SimulatedDriverOptions {
  clock: Clock;
  constants?: Partial<ThermalConstants>;
  /** What the simulated sketch replies to VERSION. Set another value to test a mismatch. */
  protocolVersion?: number;
}

/** A twin of the Skywalker + SkyCommand setup on a simple thermal model (docs/spec/hardware.md). */
export class SimulatedDriver implements RoasterDriver {
  readonly channels: readonly Channel[] = SKYWALKER_CHANNELS;

  readonly #clock: Clock;
  readonly #constants: ThermalConstants;
  readonly #protocolVersion: number;
  readonly #outputs = new Map<string, OutputChannel>();
  readonly #values = new Map<string, number>();
  #tempC: number;
  #stalledTempC: number | undefined;
  #simulatedToMs: number;
  #lastCommandMs: number;
  #connected = false;
  #unplugged = false;

  constructor(options: SimulatedDriverOptions) {
    this.#clock = options.clock;
    this.#constants = { ...DEFAULT_THERMAL_CONSTANTS, ...options.constants };
    this.#protocolVersion = options.protocolVersion ?? SKYWALKER_PROTOCOL_VERSION;
    this.#tempC = this.#constants.ambientC;
    this.#simulatedToMs = this.#clock.now();
    this.#lastCommandMs = this.#clock.now();
    for (const channel of this.channels) {
      if (channel.kind === 'output') {
        this.#outputs.set(channel.id, channel);
        this.#values.set(channel.id, 0);
      }
    }
  }

  connect(): Promise<Result<void, DriverError>> {
    this.#advance();
    if (this.#unplugged) return Promise.resolve(err({ kind: 'disconnected' }));
    if (this.#protocolVersion !== SKYWALKER_PROTOCOL_VERSION) {
      return Promise.resolve(
        err({
          kind: 'version-mismatch',
          expected: SKYWALKER_PROTOCOL_VERSION,
          actual: this.#protocolVersion,
        }),
      );
    }
    this.#connected = true;
    this.#lastCommandMs = this.#clock.now();
    return Promise.resolve(ok(undefined));
  }

  read(): Promise<Result<Reading, DriverError>> {
    this.#advance();
    if (!this.#reachable()) return Promise.resolve(err({ kind: 'disconnected' }));
    this.#lastCommandMs = this.#clock.now();
    return Promise.resolve(
      ok({
        atMs: this.#clock.now(),
        // Like the real driver: the temperature plus every output (docs/spec/hardware.md).
        values: { ...Object.fromEntries(this.#values), bt: this.#stalledTempC ?? this.#tempC },
      }),
    );
  }

  setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    this.#advance();
    if (!this.#reachable()) return Promise.resolve(err({ kind: 'disconnected' }));
    const output = this.#outputs.get(channel);
    if (!output) return Promise.resolve(err({ kind: 'unknown-channel', channel }));
    this.#values.set(channel, quantize(output, value));
    this.#lastCommandMs = this.#clock.now();
    return Promise.resolve(ok(undefined));
  }

  async safeStop(): Promise<void> {
    // On a broken link the commands fail; the sketch watchdog then switches everything off.
    for (const [channel, value] of SKYWALKER_SAFE_STOP) await this.setOutput(channel, value);
  }

  disconnect(): Promise<void> {
    this.#advance();
    this.#connected = false;
    return Promise.resolve();
  }

  /** Fault: keep reporting the current temperature, like the sketch's stale readings. */
  stallTemperature(stalled: boolean): void {
    this.#advance();
    this.#stalledTempC = stalled ? this.#tempC : undefined;
  }

  /** Fault: the USB cable is pulled. The roaster keeps running until the watchdog trips. */
  unplug(): void {
    this.#advance();
    this.#unplugged = true;
    this.#connected = false;
  }

  /** The cable is back. Call `connect()` again before talking to the roaster. */
  plugIn(): void {
    this.#advance();
    this.#unplugged = false;
  }

  #reachable(): boolean {
    return this.#connected && !this.#unplugged;
  }

  #value(channel: string): number {
    return this.#values.get(channel) ?? 0;
  }

  /** Runs the thermal model and the sketch's own safety up to the clock's current time. */
  #advance(): void {
    const now = this.#clock.now();
    while (this.#simulatedToMs < now) {
      const dtMs = Math.min(STEP_MS, now - this.#simulatedToMs);
      this.#simulatedToMs += dtMs;
      if (this.#simulatedToMs - this.#lastCommandMs > SKYWALKER_WATCHDOG_MS) {
        for (const channel of this.#outputs.keys()) this.#values.set(channel, 0);
      }
      this.#tempC = stepTemperature(
        this.#tempC,
        { heater: this.#value('heater'), fan: this.#value('fan'), cooling: this.#value('cooling') },
        this.#constants,
        dtMs / 1000,
      );
      if (this.#tempC > SKYWALKER_ESTOP_C) {
        this.#values.set('heater', 0);
        this.#values.set('fan', 100);
      }
    }
  }
}
