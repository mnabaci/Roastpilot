import {
  err,
  ok,
  READY_ROAST,
  type DriverError,
  type Reading,
  type Result,
  type RoastAction,
  type RoastActionError,
  type RoastEvent,
  type RoastState,
} from '@roastpilot/shared';
import type { Clock } from '../clock';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
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

export { FILTER_ON } from './roast-outputs';
export { DEFAULT_COOLING_MS, EXTEND_COOLING_MS, type RoastOptions } from './roast-rules';

export interface ManualRoastDeps {
  clock: Clock;
  setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  /** Latest bean temperature, for event records. */
  latestBt: () => number | undefined;
  /** Readings kept since Preheat, oldest first: for the charge point and the turning point. */
  readings?: () => readonly Reading[];
  onChange: (state: RoastState) => void;
  /** Preheat began: a new roast, so earlier readings can go. */
  onNewRoast: () => void;
  /** Charge (at the charge point): arms the max-roast-time rule. */
  onRoastStarted: (chargedAtMs: number) => void;
  /** Drop: the roast is over for the max-roast-time rule. */
  onRoastEnded: () => void;
  options?: () => RoastOptions;
  logger?: Logger;
}

const READY = READY_ROAST;

/** The manual roast flow: Ready → Preheat → Roasting → Development → Cooling → Done. */
export class ManualRoast {
  readonly #deps: ManualRoastDeps;
  readonly #options: () => RoastOptions;
  readonly #readings: () => readonly Reading[];
  readonly #logger: Logger;
  #state: RoastState = READY;
  readonly #cooling: RoasterCooling;
  /** Bumped when cooling restarts or ends, so an old cooling timer can't end it later. */
  #coolingRun = 0;

  constructor(deps: ManualRoastDeps) {
    this.#deps = deps;
    this.#options = deps.options ?? (() => DEFAULT_OPTIONS);
    this.#readings = deps.readings ?? (() => []);
    this.#logger = deps.logger ?? silentLogger;
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
    if (!ALLOWED_FROM[action].includes(phase)) {
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

  /** One step per action; ALLOWED_FROM has already checked the state. */
  readonly #steps: Readonly<Record<RoastAction, (nowMs: number) => Promise<void>>> = {
    preheat: async (nowMs) => {
      // A cool-down's fan at 100 would fight the preheat: back to 0, you set it.
      const fanOff: Outputs = this.#cooling.stopWithoutOutputs('preheat') ? [['fan', 0]] : [];
      this.#deps.onNewRoast();
      this.#set({ ...READY, phase: 'preheat', preheatAtMs: nowMs });
      await this.#send([...fanOff, ...ROAST_ON]);
    },
    start: async (nowMs) => {
      const charge = chargeFor(this.#state, this.#readings(), nowMs, {
        findPoint: this.#options().findChargePoint,
        latestBt: this.#deps.latestBt(),
      });
      if (charge.earlierMs > 0)
        this.#logger.info('roast.charge-found', { earlierMs: charge.earlierMs });
      this.#set({
        ...this.#state,
        phase: 'roasting',
        chargedAtMs: charge.atMs,
        startPressedAtMs: nowMs,
        events: [{ kind: 'charge', atMs: charge.atMs, bt: charge.bt }],
      });
      this.#deps.onRoastStarted(charge.atMs);
      await this.#send(ROAST_ON);
    },
    'first-crack': (nowMs) => {
      this.#set({
        ...this.#state,
        phase: 'development',
        firstCrackAtMs: nowMs,
        events: [...this.#state.events, this.#event('first-crack', nowMs)],
      });
      return Promise.resolve();
    },
    // Forgets the last roast's readings and events; sends nothing. A cool-down keeps running.
    clear: () => {
      this.#deps.onNewRoast();
      this.#set({ ...READY, roasterCoolingSinceMs: this.#state.roasterCoolingSinceMs });
      return Promise.resolve();
    },
    drop: async (nowMs) => {
      this.#drop(nowMs);
      await this.#send(DROP_OUTPUTS);
    },
    // In Preheat nothing has roasted: back to Ready, the preheat stays on the chart until Clear. In
    // Cooling it finishes cooling now. In between it ends the roast where it is.
    end: async (nowMs) => {
      this.#coolingRun++;
      if (this.#state.phase === 'preheat') {
        this.#set({ ...READY, preheatAtMs: this.#state.preheatAtMs });
        await this.#send(ALL_OFF);
        return;
      }
      if (this.#state.phase === 'cooling') {
        await this.#finishCooling();
        return;
      }
      this.#set({
        ...this.#state,
        phase: 'done',
        events: [...this.#state.events, this.#event('end', nowMs)],
      });
      this.#deps.onRoastEnded();
      await this.#send(ALL_OFF);
    },
    'extend-cooling': () => {
      const endsAtMs = (this.#state.coolingEndsAtMs ?? this.#deps.clock.now()) + EXTEND_COOLING_MS;
      this.#set({ ...this.#state, coolingEndsAtMs: endsAtMs });
      this.#scheduleCoolingEnd(endsAtMs);
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

  #drop(nowMs: number): void {
    const coolingEndsAtMs = nowMs + this.#options().coolingMs;
    this.#set({
      ...this.#state,
      phase: 'cooling',
      droppedAtMs: nowMs,
      coolingEndsAtMs,
      events: [...this.#state.events, this.#event('drop', nowMs)],
    });
    this.#deps.onRoastEnded();
    this.#scheduleCoolingEnd(coolingEndsAtMs);
  }

  /** Ends cooling at `endsAtMs`; any earlier timer stands down. */
  #scheduleCoolingEnd(endsAtMs: number): void {
    const run = ++this.#coolingRun;
    this.#deps.clock
      .delay(Math.max(0, endsAtMs - this.#deps.clock.now()))
      .then(() =>
        run === this.#coolingRun && this.#state.phase === 'cooling'
          ? this.#finishCooling()
          : undefined,
      )
      .catch((error: unknown) => {
        this.#logger.error('roast.cooling-timer-failed', { error: serializeError(error) });
      });
  }

  /** Bean cooling is over: everything off, or on to the roaster cool-down while the drum is hot. */
  async #finishCooling(): Promise<void> {
    const nowMs = this.#deps.clock.now();
    this.#set({
      ...this.#state,
      phase: 'done',
      coolingEndsAtMs: null,
      events: [...this.#state.events, this.#event('cool-end', nowMs)],
    });
    const bt = this.#deps.latestBt();
    if (this.#options().coolRoasterAfter && bt !== undefined && bt >= ROASTER_COOL_C) {
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
