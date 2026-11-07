import type { Reading, RoastState } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import { BEAN_TEMP } from '../safety/safety-rule';
import type { Outputs } from './roast-outputs';
import {
  ROASTER_COOL_AFTER_DROP_MAX_MS,
  ROASTER_COOL_MAX_MS,
  roasterCooldownCheck,
} from './roaster-cooldown';

/** What drum cooling needs from the roast it belongs to. */
export interface CoolingHost {
  state(): RoastState;
  set(state: RoastState): void;
  send(outputs: Outputs): Promise<void>;
  latestBt(): number | undefined;
  /** What the coolings running now need (coolingOutputs). */
  coolingOutputs(): Outputs;
}

/** Ends that set the outputs, and ends where something else already set them. */
type EndWithOutputs = 'cooled' | 'gave-up' | 'stopped';
type EndWithout = 'preheat' | 'roast-started' | 'heater-on' | 'safety-stop' | 'disconnected';

/**
 * Drum cooling (docs/spec/manual-mode.md): fan and drum run until the empty drum is below its
 * target, from Drop or from Cool the drum. Its state lives in the roast's `roasterCoolingSinceMs`.
 */
export class RoasterCooling {
  readonly #host: CoolingHost;
  readonly #logger: Logger;
  #maxMs = ROASTER_COOL_MAX_MS;

  constructor(host: CoolingHost, logger: Logger) {
    this.#host = host;
    this.#logger = logger;
  }

  get running(): boolean {
    return this.#host.state().roasterCoolingSinceMs !== null;
  }

  async start(sinceMs: number, toC: number, reason: 'asked' | 'after-roast'): Promise<void> {
    this.#logger.info('roast.roaster-cooling-started', { reason, toC, bt: this.#host.latestBt() });
    this.#maxMs = reason === 'after-roast' ? ROASTER_COOL_AFTER_DROP_MAX_MS : ROASTER_COOL_MAX_MS;
    this.#host.set({ ...this.#host.state(), roasterCoolingSinceMs: sinceMs, roasterCoolToC: toC });
    await this.#host.send(this.#host.coolingOutputs());
  }

  /** Every reading: done once the drum is below its target, or at the cap whatever it says. */
  async onReading(reading: Reading): Promise<void> {
    const { roasterCoolingSinceMs: since, roasterCoolToC: toC } = this.#host.state();
    if (since === null || toC === null) return;
    const bt = reading.values[BEAN_TEMP];
    const check = roasterCooldownCheck(since, reading.atMs, bt, toC, this.#maxMs);
    if (check !== 'running') await this.end(check);
  }

  /** Ends it and sends what is still running (the beans', or all off); nothing when not running. */
  async end(reason: EndWithOutputs): Promise<void> {
    if (!this.#forget(reason)) return;
    await this.#host.send(this.#host.coolingOutputs());
  }

  /** Ends it without sending: a new roast, the heater, a safety stop or a disconnect owns the outputs. */
  stopWithoutOutputs(reason: EndWithout): boolean {
    return this.#forget(reason);
  }

  #forget(reason: EndWithOutputs | EndWithout): boolean {
    if (!this.running) return false;
    const context = { reason, bt: this.#host.latestBt() };
    if (reason === 'gave-up') this.#logger.warn('roast.roaster-cooling-ended', context);
    else this.#logger.info('roast.roaster-cooling-ended', context);
    this.#host.set({ ...this.#host.state(), roasterCoolingSinceMs: null, roasterCoolToC: null });
    return true;
  }
}
