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
  type RoastPhase,
  type RoastState,
} from '@roastpilot/shared';
import type { Clock } from '../clock';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import { BEAN_TEMP } from '../safety/safety-rule';
import { findChargePoint } from './charge-point';
import { ALL_OFF, DROP_OUTPUTS, ROAST_ON, ROASTER_COOLING, type Outputs } from './roast-outputs';
import { ROASTER_COOL_C, roasterCooldownCheck } from './roaster-cooldown';
import { findTurningPoint } from './turning-point';

export { FILTER_ON } from './roast-outputs';

/** Default cooling time; the Cooling time setting overrides it. */
export const DEFAULT_COOLING_MS = 4 * 60_000;
/** What +1 min adds to the cooling countdown. */
export const EXTEND_COOLING_MS = 60_000;

/** Which states each action may start from (docs/spec/manual-mode.md, Manual roast flow). */
const ALLOWED_FROM: Readonly<Record<RoastAction, readonly RoastPhase[]>> = {
  preheat: ['ready', 'done'],
  // Full control may skip Preheat; the drum and filter fan still come on.
  start: ['ready', 'preheat'],
  'first-crack': ['roasting'],
  drop: ['roasting', 'development'],
  // Only with no roast running, so a roast in progress can't be wiped by accident.
  clear: ['ready', 'done'],
  // End roast / Finish cooling now: a normal stop, no heater lock (docs/spec/manual-mode.md).
  end: ['preheat', 'roasting', 'development', 'cooling'],
  'extend-cooling': ['cooling'],
  'cool-roaster': ['ready', 'done'],
  'stop-cooling-roaster': ['ready', 'done'],
};

/** What each phase keeps running, put back after a reconnect; never the heater above 0. */
const PHASE_OUTPUTS: Readonly<Record<RoastPhase, Outputs>> = {
  ready: [],
  preheat: ROAST_ON,
  roasting: ROAST_ON,
  development: ROAST_ON,
  cooling: [...DROP_OUTPUTS, ...ROAST_ON],
  done: [],
};

/** The roast settings ManualRoast follows, read at the moment they matter. */
export interface RoastOptions {
  findChargePoint: boolean;
  coolingMs: number;
  coolRoasterAfter: boolean;
}

const DEFAULT_OPTIONS: RoastOptions = {
  findChargePoint: true,
  coolingMs: DEFAULT_COOLING_MS,
  coolRoasterAfter: true,
};

/** Why the roaster cool-down ended, for the log. */
type CooldownEnd = 'cooled' | 'gave-up' | 'stopped' | 'preheat' | 'safety-stop' | 'disconnected';

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
  /** Bumped when cooling restarts or ends, so an old cooling timer can't end it later. */
  #coolingRun = 0;

  constructor(deps: ManualRoastDeps) {
    this.#deps = deps;
    this.#options = deps.options ?? (() => DEFAULT_OPTIONS);
    this.#readings = deps.readings ?? (() => []);
    this.#logger = deps.logger ?? silentLogger;
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
    const since = this.#state.roasterCoolingSinceMs;
    if (since === null) return;
    const check = roasterCooldownCheck(since, reading.atMs, reading.values[BEAN_TEMP]);
    if (check !== 'running') await this.#endRoasterCooling(check, ALL_OFF);
  }

  /**
   * A new connection (or readings back after a lost one) starts with the roaster's outputs off:
   * put back what this phase keeps running (docs/spec/manual-mode.md, After a reconnect).
   */
  async restoreOutputs(): Promise<void> {
    const { phase, roasterCoolingSinceMs } = this.#state;
    const outputs = roasterCoolingSinceMs === null ? PHASE_OUTPUTS[phase] : ROASTER_COOLING;
    if (outputs.length === 0) return;
    this.#logger.info('roast.outputs-restored', { phase });
    await this.#send(outputs);
  }

  /**
   * A safety stop or a disconnect ends the roaster cool-down. Sends nothing: the safe stop has
   * set the outputs, and without a roaster there is nothing to send to.
   */
  stopRoasterCooling(reason: 'safety-stop' | 'disconnected'): void {
    if (this.#state.roasterCoolingSinceMs === null) return;
    this.#logger.info('roast.roaster-cooling-ended', { reason });
    this.#set({ ...this.#state, roasterCoolingSinceMs: null });
  }

  /** One step per action; ALLOWED_FROM has already checked the state. */
  readonly #steps: Readonly<Record<RoastAction, (nowMs: number) => Promise<void>>> = {
    preheat: async (nowMs) => {
      // A cool-down's fan at 100 would fight the preheat: back to 0, you set it.
      const fanOff: Outputs = this.#state.roasterCoolingSinceMs === null ? [] : [['fan', 0]];
      if (fanOff.length > 0)
        this.#logger.info('roast.roaster-cooling-ended', { reason: 'preheat' });
      this.#deps.onNewRoast();
      this.#set({ ...READY, phase: 'preheat', preheatAtMs: nowMs });
      await this.#send([...fanOff, ...ROAST_ON]);
    },
    start: async (nowMs) => {
      const found = this.#chargePoint(nowMs);
      const chargedAtMs = found?.atMs ?? nowMs;
      if (found) this.#logger.info('roast.charge-found', { earlierMs: nowMs - chargedAtMs });
      this.#set({
        ...this.#state,
        phase: 'roasting',
        chargedAtMs,
        startPressedAtMs: nowMs,
        events: [
          {
            kind: 'charge',
            atMs: chargedAtMs,
            bt: found?.values[BEAN_TEMP] ?? this.#deps.latestBt() ?? null,
          },
        ],
      });
      this.#deps.onRoastStarted(chargedAtMs);
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
    // In Preheat nothing has roasted: back to Ready, the readings stay on the chart. In Cooling it
    // finishes cooling now. In between it ends the roast where it is.
    end: async (nowMs) => {
      this.#coolingRun++;
      if (this.#state.phase === 'preheat') {
        this.#set(READY);
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
      await this.#startRoasterCooling(nowMs, 'asked');
    },
    'stop-cooling-roaster': async () => {
      await this.#endRoasterCooling('stopped', ALL_OFF);
    },
  };

  /** The reading before the charge drop, looked for since Preheat; none when the setting is off. */
  #chargePoint(nowMs: number): Reading | undefined {
    if (!this.#options().findChargePoint) return undefined;
    const since = this.#state.preheatAtMs ?? Number.NEGATIVE_INFINITY;
    return findChargePoint(
      this.#readings().filter((r) => r.atMs >= since),
      nowMs,
    );
  }

  #markTurningPoint(): void {
    const { phase, chargedAtMs, events } = this.#state;
    if (phase !== 'roasting' || chargedAtMs === null) return;
    if (events.some((e) => e.kind === 'turning-point')) return;
    const found = findTurningPoint(this.#readings(), chargedAtMs);
    if (!found) return;
    const bt = found.values[BEAN_TEMP] ?? null;
    this.#logger.info('roast.turning-point', { afterChargeMs: found.atMs - chargedAtMs, bt });
    this.#set({
      ...this.#state,
      events: [...events, { kind: 'turning-point', atMs: found.atMs, bt }],
    });
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
      await this.#startRoasterCooling(nowMs, 'after-roast');
      return;
    }
    await this.#send(ALL_OFF);
  }

  async #startRoasterCooling(nowMs: number, reason: 'asked' | 'after-roast'): Promise<void> {
    this.#logger.info('roast.roaster-cooling-started', { reason, bt: this.#deps.latestBt() });
    this.#set({ ...this.#state, roasterCoolingSinceMs: nowMs });
    await this.#send(ROASTER_COOLING);
  }

  async #endRoasterCooling(reason: CooldownEnd, outputs: Outputs): Promise<void> {
    if (this.#state.roasterCoolingSinceMs === null) return;
    const context = { reason, bt: this.#deps.latestBt() };
    if (reason === 'gave-up') this.#logger.warn('roast.roaster-cooling-ended', context);
    else this.#logger.info('roast.roaster-cooling-ended', context);
    this.#set({ ...this.#state, roasterCoolingSinceMs: null });
    await this.#send(outputs);
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
