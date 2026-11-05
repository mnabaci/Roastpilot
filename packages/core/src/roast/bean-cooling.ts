import type { Reading, RoastEvent } from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import { BEAN_TEMP } from '../safety/safety-rule';
import { CoolingTimer } from './cooling-timer';
import { ALL_OFF } from './roast-outputs';
import { EXTEND_COOLING_MS, type RoastOptions } from './roast-rules';
import { cooled, dropped } from './roast-transitions';
import type { CoolingHost, RoasterCooling } from './roaster-cooling';

/** What bean cooling needs from the roast it belongs to. */
export interface BeanCoolingHost extends CoolingHost {
  options(): RoastOptions;
  /** Connected and not locked by a safety stop: the roaster cool-down may follow. */
  canCoolRoaster(): boolean;
  event(kind: RoastEvent['kind'], atMs: number): RoastEvent;
}

/**
 * Bean cooling (docs/spec/manual-mode.md, Cooling ends): from Drop until the countdown ends, or
 * until BT is below the target (at most BEAN_COOL_MAX_MS); then everything off, or on to the
 * roaster cool-down while the drum is hot.
 */
export class BeanCooling {
  readonly #host: BeanCoolingHost;
  readonly #roaster: RoasterCooling;
  readonly #clock: Clock;
  readonly #logger: Logger;
  readonly #timer: CoolingTimer;

  constructor(host: BeanCoolingHost, roaster: RoasterCooling, clock: Clock, logger: Logger) {
    this.#host = host;
    this.#roaster = roaster;
    this.#clock = clock;
    this.#logger = logger;
    this.#timer = new CoolingTimer(clock, logger);
  }

  /** Cooling ends by temperature, so +1 min means nothing. */
  get byTemperature(): boolean {
    return this.#host.state().coolingBelowC !== null;
  }

  /** Drop: cooling starts, by time or temperature as the settings say now. */
  start(drop: RoastEvent): void {
    this.#host.set(dropped(this.#host.state(), drop, this.#host.options()));
    this.#schedule();
  }

  /** +1 min, from the planned end or from now if a late timer hasn't fired yet. */
  extend(nowMs: number): void {
    const state = this.#host.state();
    const endsAtMs = Math.max(state.coolingEndsAtMs ?? nowMs, nowMs) + EXTEND_COOLING_MS;
    this.#host.set({ ...state, coolingEndsAtMs: endsAtMs });
    this.#schedule();
  }

  /** Finish cooling now. */
  async finishNow(): Promise<void> {
    this.#timer.cancel();
    await this.#finish();
  }

  /** The roast ended another way: no cooling end may follow. */
  cancel(): void {
    this.#timer.cancel();
  }

  /** Cooling by temperature: ends at the first reading below the target. */
  async onReading(reading: Reading): Promise<void> {
    const { phase, coolingBelowC } = this.#host.state();
    const bt = reading.values[BEAN_TEMP];
    if (phase !== 'cooling' || coolingBelowC === null || bt === undefined || bt >= coolingBelowC)
      return;
    this.#logger.info('roast.cooling-reached', { belowC: coolingBelowC, bt });
    await this.finishNow();
  }

  #schedule(): void {
    const endsAtMs = this.#host.state().coolingEndsAtMs;
    if (endsAtMs === null) return;
    this.#timer.schedule(endsAtMs, () => {
      const { phase, coolingBelowC } = this.#host.state();
      if (phase !== 'cooling') return Promise.resolve();
      // By temperature, the timer is the cap: the probe never got there.
      if (coolingBelowC !== null)
        this.#logger.warn('roast.cooling-gave-up', {
          belowC: coolingBelowC,
          bt: this.#host.latestBt(),
        });
      return this.#finish();
    });
  }

  async #finish(): Promise<void> {
    const nowMs = this.#clock.now();
    this.#host.set(cooled(this.#host.state(), this.#host.event('cool-end', nowMs)));
    const bt = this.#host.latestBt();
    const { coolRoasterAfter, roasterCoolToC } = this.#host.options();
    const hot = bt !== undefined && bt >= roasterCoolToC;
    if (coolRoasterAfter && hot && this.#host.canCoolRoaster()) {
      await this.#roaster.start(nowMs, roasterCoolToC, 'after-roast');
      return;
    }
    await this.#host.send(ALL_OFF);
  }
}
