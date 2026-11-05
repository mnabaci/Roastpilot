import type { Reading, RoastState } from '@roastpilot/shared';
import type { Logger } from '../logging/logger';
import { BEAN_TEMP } from '../safety/safety-rule';
import { ALL_OFF, ROASTER_COOLING, type Outputs } from './roast-outputs';
import { roasterCooldownCheck } from './roaster-cooldown';

/** What the roaster cool-down needs from the roast it belongs to. */
export interface CoolingHost {
  state(): RoastState;
  set(state: RoastState): void;
  send(outputs: Outputs): Promise<void>;
  latestBt(): number | undefined;
}

/** Ends that turn everything off, and ends where something else already set the outputs. */
type EndWithOutputs = 'cooled' | 'gave-up' | 'stopped';
type EndWithout = 'preheat' | 'roast-started' | 'heater-on' | 'safety-stop' | 'disconnected';

/**
 * Roaster cool-down (docs/spec/manual-mode.md): fan and drum run after the roast until the empty
 * drum is below 50 °C. Its state lives in the roast's `roasterCoolingSinceMs`.
 */
export class RoasterCooling {
  readonly #host: CoolingHost;
  readonly #logger: Logger;

  constructor(host: CoolingHost, logger: Logger) {
    this.#host = host;
    this.#logger = logger;
  }

  get running(): boolean {
    return this.#host.state().roasterCoolingSinceMs !== null;
  }

  async start(nowMs: number, toC: number, reason: 'asked' | 'after-roast'): Promise<void> {
    this.#logger.info('roast.roaster-cooling-started', { reason, toC, bt: this.#host.latestBt() });
    this.#host.set({ ...this.#host.state(), roasterCoolingSinceMs: nowMs, roasterCoolToC: toC });
    await this.#host.send(ROASTER_COOLING);
  }

  /** Every reading: done once the drum is below its target, or after 15 min whatever it says. */
  async onReading(reading: Reading): Promise<void> {
    const { roasterCoolingSinceMs: since, roasterCoolToC: toC } = this.#host.state();
    if (since === null || toC === null) return;
    const check = roasterCooldownCheck(since, reading.atMs, reading.values[BEAN_TEMP], toC);
    if (check !== 'running') await this.end(check);
  }

  /** Ends it and turns everything off; does nothing when it isn't running. */
  async end(reason: EndWithOutputs): Promise<void> {
    if (!this.#forget(reason)) return;
    await this.#host.send(ALL_OFF);
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
