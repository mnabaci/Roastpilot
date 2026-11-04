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
import { serializeError } from '../logging/serialize-error';
import { CoolingTimer } from './cooling-timer';
import type { ManualRoastDeps } from './manual-roast-deps';
import { ALL_OFF, DROP_OUTPUTS, ROAST_ON, ROASTER_COOLING, type Outputs } from './roast-outputs';
import {
  ALLOWED_FROM,
  DEFAULT_OPTIONS,
  EXTEND_COOLING_MS,
  PHASE_OUTPUTS,
  type RoastOptions,
} from './roast-rules';
import { ROASTER_COOL_C } from './roaster-cooldown';
import { RoasterCooling } from './roaster-cooling';
import { chargeFor, turningPointEvent } from './roast-detections';
import {
  cleared,
  cooled,
  cracked,
  dropped,
  ended,
  preheated,
  preheatEnded,
  started,
} from './roast-transitions';

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
  readonly #coolingTimer: CoolingTimer;

  constructor(deps: ManualRoastDeps) {
    this.#deps = deps;
    this.#options = deps.options ?? (() => DEFAULT_OPTIONS);
    this.#readings = deps.readings ?? (() => []);
    this.#canCoolRoaster = deps.canCoolRoaster ?? (() => true);
    this.#logger = deps.logger ?? silentLogger;
    this.#coolingTimer = new CoolingTimer(deps.clock, this.#logger);
    this.#cooling = new RoasterCooling(
      {
        state: () => this.#state,
        set: (state) => {
          this.#set(state);
        },
        send: (outputs) => this.#send(outputs),
        latestBt: () => deps.latestBt(),
      },
      this.#logger,
    );
  }

  get state(): RoastState {
    return this.#state;
  }

  async act(action: RoastAction): Promise<Result<void, RoastActionError>> {
    const phase = this.#state.phase;
    // The roaster cool-down also needs a roaster that can take it: connected, no safety stop.
    const coolingRefused = action === 'cool-roaster' && !this.#canCoolRoaster();
    if (!ALLOWED_FROM[action].includes(phase) || coolingRefused) {
      this.#logger.info('roast.action-not-allowed', { action, phase });
      return err({ kind: 'not-allowed', action, phase });
    }
    const nowMs = this.#deps.clock.now();
    this.#logger.info('roast.action', { action, from: phase });
    await this.#steps[action](nowMs);
    return ok(undefined);
  }

  /**
   * Every reading, after it is kept: finds the turning point while roasting, and ends the
   * roaster cool-down once the drum is cool (docs/spec/manual-mode.md).
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
    const outputs = this.#cooling.running ? ROASTER_COOLING : PHASE_OUTPUTS[phase];
    if (outputs.length === 0) return;
    this.#logger.info('roast.outputs-restored', { phase });
    await this.#send(outputs);
  }

  /**
   * A safety stop or a disconnect ends the roaster cool-down. Sends nothing: the safe stop has
   * set the outputs, and without a roaster there is nothing to send to.
   */
  stopRoasterCooling(reason: 'safety-stop' | 'disconnected'): void {
    this.#cooling.stopWithoutOutputs(reason);
  }

  /**
   * Every output you ask for: turning the heater on ends a roaster cool-down, which would
   * otherwise fight it with the fan and later switch it off. Your outputs stay as you set them.
   */
  outputRequested(channel: string, value: number): void {
    if (channel === 'heater' && value > 0) this.#cooling.stopWithoutOutputs('heater-on');
  }

  /** One step per action; ALLOWED_FROM has already checked the state. */
  readonly #steps: Readonly<Record<RoastAction, (nowMs: number) => Promise<void>>> = {
    preheat: async (nowMs) => {
      const fanOff = this.#endCoolingForRoast('preheat');
      this.#deps.onNewRoast();
      this.#set(preheated(nowMs));
      await this.#send([...fanOff, ...ROAST_ON]);
    },
    start: async (nowMs) => {
      const fanOff = this.#endCoolingForRoast('roast-started');
      const charge = chargeFor(this.#state, this.#readings(), nowMs, {
        findPoint: this.#options().findChargePoint,
        latestBt: this.#deps.latestBt(),
      });
      if (charge.earlierMs > 0)
        this.#logger.info('roast.charge-found', { earlierMs: charge.earlierMs });
      this.#set(started(this.#state, charge, nowMs));
      this.#deps.onRoastStarted(charge.atMs);
      await this.#send([...fanOff, ...ROAST_ON]);
    },
    'first-crack': (nowMs) => {
      this.#set(cracked(this.#state, this.#event('first-crack', nowMs)));
      return Promise.resolve();
    },
    // Forgets the last roast's readings and events; sends nothing. A cool-down keeps running.
    clear: () => {
      this.#deps.onNewRoast();
      this.#set(cleared(this.#state));
      return Promise.resolve();
    },
    drop: async (nowMs) => {
      this.#set(dropped(this.#state, this.#event('drop', nowMs), this.#options().coolingMs));
      this.#deps.onRoastEnded();
      this.#scheduleCoolingEnd();
      await this.#send(DROP_OUTPUTS);
    },
    // In Preheat nothing has roasted: back to Ready, the preheat stays on the chart until Clear. In
    // Cooling it finishes cooling now. In between it ends the roast where it is.
    end: async (nowMs) => {
      this.#coolingTimer.cancel();
      if (this.#state.phase === 'cooling') {
        await this.#finishCooling();
        return;
      }
      if (this.#state.phase === 'preheat') this.#set(preheatEnded(this.#state));
      else {
        this.#set(ended(this.#state, this.#event('end', nowMs)));
        this.#deps.onRoastEnded();
      }
      await this.#send(ALL_OFF);
    },
    // From the planned end, or from now if a late timer hasn't fired yet: always a minute more.
    'extend-cooling': (nowMs) => {
      const endsAtMs = Math.max(this.#state.coolingEndsAtMs ?? nowMs, nowMs) + EXTEND_COOLING_MS;
      this.#set({ ...this.#state, coolingEndsAtMs: endsAtMs });
      this.#scheduleCoolingEnd();
      return Promise.resolve();
    },
    'cool-roaster': async (nowMs) => {
      await this.#cooling.start(nowMs, 'asked');
    },
    'stop-cooling-roaster': async () => {
      await this.#cooling.end('stopped');
    },
  };

  #markTurningPoint(): void {
    const tp = turningPointEvent(this.#state, this.#readings());
    if (!tp) return;
    const afterChargeMs = tp.atMs - (this.#state.chargedAtMs ?? tp.atMs);
    this.#logger.info('roast.turning-point', { afterChargeMs, bt: tp.bt });
    this.#set({ ...this.#state, events: [...this.#state.events, tp] });
  }

  /** A roast begins: a running cool-down ends, and its fan at 100 goes back to 0 (you set it). */
  #endCoolingForRoast(reason: 'preheat' | 'roast-started'): Outputs {
    return this.#cooling.stopWithoutOutputs(reason) ? [['fan', 0]] : [];
  }

  #scheduleCoolingEnd(): void {
    const endsAtMs = this.#state.coolingEndsAtMs;
    if (endsAtMs === null) return;
    this.#coolingTimer.schedule(endsAtMs, () =>
      this.#state.phase === 'cooling' ? this.#finishCooling() : Promise.resolve(),
    );
  }

  /**
   * Bean cooling is over: everything off, or on to the roaster cool-down while the drum is hot
   * and the roaster can take it (connected, no safety stop).
   */
  async #finishCooling(): Promise<void> {
    const nowMs = this.#deps.clock.now();
    this.#set(cooled(this.#state, this.#event('cool-end', nowMs)));
    const bt = this.#deps.latestBt();
    const hot = bt !== undefined && bt >= ROASTER_COOL_C;
    if (this.#options().coolRoasterAfter && hot && this.#canCoolRoaster()) {
      await this.#cooling.start(nowMs, 'after-roast');
      return;
    }
    await this.#send(ALL_OFF);
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
    try {
      this.#deps.onChange(state);
    } catch (error) {
      this.#logger.error('roast.listener-failed', { error: serializeError(error) });
    }
  }
}
