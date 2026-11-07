import {
  err,
  ok,
  READY_ROAST,
  type Reading,
  type Result,
  type RoastAction,
  type RoastActionError,
  type RoastEvent,
  type RoastState,
} from '@roastpilot/shared';
import { silentLogger, type Logger } from '../logging/logger';
import { guardListener } from '../logging/guard-listener';
import { BeanCooling } from './bean-cooling';
import type { ManualRoastDeps } from './manual-roast-deps';
import { coolingOutputs } from './cooling-outputs';
import type { Outputs } from './roast-outputs';
import { ALLOWED_FROM, DEFAULT_OPTIONS, phaseOutputs, type RoastOptions } from './roast-rules';
import { RoasterCooling } from './roaster-cooling';
import { turningPointEvent } from './roast-detections';
import { roastSteps, type RoastSteps } from './roast-steps';

export { FILTER_ON } from './roast-outputs';
export { DEFAULT_COOLING_MS, EXTEND_COOLING_MS, type RoastOptions } from './roast-rules';
export type { ManualRoastDeps } from './manual-roast-deps';

/** The manual roast flow: Ready → Preheat → Roasting → Development → Cooling → Done. */
export class ManualRoast {
  readonly #deps: ManualRoastDeps;
  readonly #options: () => RoastOptions;
  readonly #readings: () => readonly Reading[];
  readonly #canCoolRoaster: () => boolean;
  readonly #logger: Logger;
  #state: RoastState = READY_ROAST;
  readonly #cooling: RoasterCooling;
  readonly #beans: BeanCooling;
  readonly #notify: (state: RoastState) => void;
  readonly #steps: RoastSteps;

  constructor(deps: ManualRoastDeps) {
    this.#deps = deps;
    this.#options = deps.options ?? (() => DEFAULT_OPTIONS);
    this.#readings = deps.readings ?? (() => []);
    this.#canCoolRoaster = deps.canCoolRoaster ?? (() => true);
    this.#logger = deps.logger ?? silentLogger;
    this.#notify = guardListener(this.#logger, 'roast.listener-failed', deps.onChange);
    const host = {
      state: () => this.#state,
      set: (state: RoastState) => {
        this.#set(state);
      },
      send: (outputs: Outputs) => this.#send(outputs),
      latestBt: () => deps.latestBt(),
      coolingOutputs: () => this.#coolingOutputs(),
    };
    this.#cooling = new RoasterCooling(host, this.#logger);
    this.#beans = new BeanCooling(
      {
        ...host,
        options: () => this.#options(),
        canCoolRoaster: () => this.#canCoolRoaster(),
        event: (kind, atMs) => this.#event(kind, atMs),
      },
      this.#cooling,
      deps.clock,
      this.#logger,
    );
    this.#steps = roastSteps({
      ...host,
      deps,
      logger: this.#logger,
      options: () => this.#options(),
      readings: () => this.#readings(),
      cooling: this.#cooling,
      beans: this.#beans,
      event: (kind, atMs) => this.#event(kind, atMs),
    });
  }

  get state(): RoastState {
    return this.#state;
  }

  async act(action: RoastAction): Promise<Result<void, RoastActionError>> {
    const phase = this.#state.phase;
    if (!ALLOWED_FROM[action].includes(phase) || this.#refused(action)) {
      this.#logger.info('roast.action-not-allowed', { action, phase });
      return err({ kind: 'not-allowed', action, phase });
    }
    const nowMs = this.#deps.clock.now();
    this.#logger.info('roast.action', { action, from: phase });
    await this.#steps[action](nowMs);
    return ok(undefined);
  }

  /**
   * Every reading, after it is kept: finds the turning point while roasting, and ends drum
   * cooling once the drum is cool (docs/spec/manual-mode.md).
   */
  async onReading(reading: Reading): Promise<void> {
    this.#markTurningPoint();
    await this.#cooling.onReading(reading);
  }

  /**
   * A new connection (or readings back after a lost one) starts with the roaster's outputs off:
   * put back what this phase keeps running (docs/spec/manual-mode.md, After a reconnect).
   */
  async restoreOutputs(): Promise<void> {
    const { phase } = this.#state;
    const cooling = phase === 'cooling' || this.#cooling.running;
    const outputs = cooling ? this.#coolingOutputs() : phaseOutputs(phase, this.#options().drumOn);
    if (outputs.length === 0) return;
    this.#logger.info('roast.outputs-restored', { phase });
    await this.#send(outputs);
  }

  /**
   * A safety stop or a disconnect ends drum cooling. Sends nothing: the safe stop has
   * set the outputs, and without a roaster there is nothing to send to.
   */
  stopRoasterCooling(reason: 'safety-stop' | 'disconnected'): void {
    this.#cooling.stopWithoutOutputs(reason);
  }

  /**
   * Every output you ask for: turning the heater on ends drum cooling, which would
   * otherwise fight it with the fan and later switch it off. Your outputs stay as you set them.
   */
  outputRequested(channel: string, value: number): void {
    if (channel === 'heater' && value > 0) this.#cooling.stopWithoutOutputs('heater-on');
  }

  /**
   * Adds what Auto or the coach did to the roast's events, so it is saved like any other
   * (data-model.md).
   */
  note(
    kind: 'dry-end' | 'phase' | 'override' | 'stall-guard' | 'mode' | 'coach-applied',
    detail?: string,
  ): void {
    const event = this.#event(kind, this.#deps.clock.now());
    const noted = detail === undefined ? event : { ...event, detail };
    this.#set({ ...this.#state, events: [...this.#state.events, noted] });
  }

  #markTurningPoint(): void {
    const tp = turningPointEvent(this.#state, this.#readings());
    if (!tp) return;
    const afterChargeMs = tp.atMs - (this.#state.chargedAtMs ?? tp.atMs);
    this.#logger.info('roast.turning-point', { afterChargeMs, bt: tp.bt });
    this.#set({ ...this.#state, events: [...this.#state.events, tp] });
    this.#deps.onTurningPoint?.(tp.atMs);
  }

  /** Heater, fan, bean cooler, drum and filter for the coolings running now. */
  #coolingOutputs(): Outputs {
    const { coolerHelpsDrum, drumOn } = this.#options();
    return coolingOutputs({
      beans: this.#state.phase === 'cooling',
      drum: this.#cooling.running,
      coolerHelpsDrum,
      drumOn,
    });
  }

  /** Actions the phase allows but the moment doesn't. */
  #refused(action: RoastAction): boolean {
    // Drum cooling needs a roaster that can take it: connected, no safety stop.
    return action === 'cool-roaster' && !this.#canCoolRoaster();
  }

  /** Sends outputs in order. A failure is logged and the rest still go out; safety covers the roaster. */
  async #send(outputs: Outputs): Promise<void> {
    for (const [channel, value] of outputs) {
      const sent = await this.#deps.setOutput(channel, value);
      if (!sent.ok) this.#logger.warn('roast.output-failed', { channel, value, error: sent.error });
    }
  }

  #event(kind: RoastEvent['kind'], atMs: number): RoastEvent {
    return { kind, atMs, bt: this.#deps.latestBt() ?? null };
  }

  #set(state: RoastState): void {
    this.#state = state;
    this.#notify(state);
  }
}
