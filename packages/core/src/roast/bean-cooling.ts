import type { RoastEvent } from '@roastpilot/shared';
import type { Clock } from '../clock';
import type { Logger } from '../logging/logger';
import { CoolingTimer } from './cooling-timer';
import { EXTEND_COOLING_MS, type RoastOptions } from './roast-rules';
import { cooled, dropped } from './roast-transitions';
import type { CoolingHost, RoasterCooling } from './roaster-cooling';

/** What bean cooling needs from the roast it belongs to. */
export interface BeanCoolingHost extends CoolingHost {
  options(): RoastOptions;
  /** Connected and not locked by a safety stop: drum cooling may start beside it. */
  canCoolRoaster(): boolean;
  event(kind: RoastEvent['kind'], atMs: number): RoastEvent;
}

/**
 * Bean cooling (docs/spec/manual-mode.md): from Drop until its countdown ends. Drum cooling
 * starts beside it while the drum is hot, and may run on after it.
 */
export class BeanCooling {
  readonly #host: BeanCoolingHost;
  readonly #roaster: RoasterCooling;
  readonly #clock: Clock;
  readonly #timer: CoolingTimer;

  constructor(host: BeanCoolingHost, roaster: RoasterCooling, clock: Clock, logger: Logger) {
    this.#host = host;
    this.#roaster = roaster;
    this.#clock = clock;
    this.#timer = new CoolingTimer(clock, logger);
  }

  /** Drop: the beans cool for the set time; the drum cools beside them while hot and allowed. */
  async start(drop: RoastEvent): Promise<void> {
    const { coolingMs, coolRoasterAfter, roasterCoolToC } = this.#host.options();
    this.#host.set(dropped(this.#host.state(), drop, coolingMs));
    this.#schedule();
    const bt = this.#host.latestBt();
    const hot = bt !== undefined && bt >= roasterCoolToC;
    if (coolRoasterAfter && hot && this.#host.canCoolRoaster()) {
      await this.#roaster.start(drop.atMs, roasterCoolToC, 'after-roast');
      return;
    }
    await this.#host.send(this.#host.coolingOutputs());
  }

  /** +1 min, from the planned end or from now if a late timer hasn't fired yet. */
  extend(nowMs: number): void {
    const state = this.#host.state();
    const endsAtMs = Math.max(state.coolingEndsAtMs ?? nowMs, nowMs) + EXTEND_COOLING_MS;
    this.#host.set({ ...state, coolingEndsAtMs: endsAtMs });
    this.#schedule();
  }

  /** Finish bean cooling now; drum cooling carries on. */
  async finishNow(): Promise<void> {
    this.#timer.cancel();
    await this.#finish();
  }

  /** The roast ended another way: no cooling end may follow. */
  cancel(): void {
    this.#timer.cancel();
  }

  #schedule(): void {
    const endsAtMs = this.#host.state().coolingEndsAtMs;
    if (endsAtMs === null) return;
    this.#timer.schedule(endsAtMs, () =>
      this.#host.state().phase === 'cooling' ? this.#finish() : Promise.resolve(),
    );
  }

  async #finish(): Promise<void> {
    const nowMs = this.#clock.now();
    this.#host.set(cooled(this.#host.state(), this.#host.event('cool-end', nowMs)));
    await this.#host.send(this.#host.coolingOutputs());
  }
}
