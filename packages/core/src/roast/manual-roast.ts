import {
  err,
  ok,
  type DriverError,
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

/** Default cooling time; per roaster later (`roasters.cool_time_s`). */
export const DEFAULT_COOLING_MS = 4 * 60_000;

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
};

type Outputs = readonly (readonly [channel: string, value: number])[];

/**
 * Drum turning and smoke filter fan running from Preheat (or Start) until cooling ends. The filter
 * takes levels 0–4; 1 is what the Artisan configs for this sketch send.
 */
export const FILTER_ON = 1;
const ROAST_ON: Outputs = [
  ['drum', 1],
  ['filter', FILTER_ON],
];
const DROP_OUTPUTS: Outputs = [
  ['heater', 0],
  ['fan', 100],
  ['cooling', 100],
];
const ALL_OFF: Outputs = [
  ['heater', 0],
  ['fan', 0],
  ['cooling', 0],
  ['drum', 0],
  ['filter', 0],
];

export interface ManualRoastDeps {
  clock: Clock;
  setOutput: (channel: string, value: number) => Promise<Result<void, DriverError>>;
  /** Latest bean temperature, for event records. */
  latestBt: () => number | undefined;
  onChange: (state: RoastState) => void;
  /** Preheat began: a new roast, so earlier readings can go. */
  onNewRoast: () => void;
  /** Charge: arms the max-roast-time rule. */
  onRoastStarted: () => void;
  /** Drop: the roast is over for the max-roast-time rule. */
  onRoastEnded: () => void;
  coolingMs?: number;
  logger?: Logger;
}

const READY: RoastState = {
  phase: 'ready',
  preheatAtMs: null,
  chargedAtMs: null,
  firstCrackAtMs: null,
  droppedAtMs: null,
  coolingEndsAtMs: null,
  events: [],
};

/** The manual roast flow: Ready → Preheat → Roasting → Development → Cooling → Done. */
export class ManualRoast {
  readonly #deps: ManualRoastDeps;
  readonly #coolingMs: number;
  readonly #logger: Logger;
  #state: RoastState = READY;
  /** Bumped when cooling restarts, so an old cooling timer can't end a newer roast. */
  #coolingRun = 0;

  constructor(deps: ManualRoastDeps) {
    this.#deps = deps;
    this.#coolingMs = deps.coolingMs ?? DEFAULT_COOLING_MS;
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

  /** One step per action; ALLOWED_FROM has already checked the state. */
  readonly #steps: Readonly<Record<RoastAction, (nowMs: number) => Promise<void>>> = {
    preheat: async (nowMs) => {
      this.#deps.onNewRoast();
      this.#set({ ...READY, phase: 'preheat', preheatAtMs: nowMs });
      await this.#send(ROAST_ON);
    },
    start: async (nowMs) => {
      this.#set({
        ...this.#state,
        phase: 'roasting',
        chargedAtMs: nowMs,
        events: [this.#event('charge', nowMs)],
      });
      this.#deps.onRoastStarted();
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
    // Forgets the last roast's readings and events; sends nothing to the roaster.
    clear: () => {
      this.#deps.onNewRoast();
      this.#set(READY);
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
  };

  #drop(nowMs: number): void {
    const coolingEndsAtMs = nowMs + this.#coolingMs;
    this.#set({
      ...this.#state,
      phase: 'cooling',
      droppedAtMs: nowMs,
      coolingEndsAtMs,
      events: [...this.#state.events, this.#event('drop', nowMs)],
    });
    this.#deps.onRoastEnded();
    const run = ++this.#coolingRun;
    this.#deps.clock
      .delay(this.#coolingMs)
      .then(() =>
        run === this.#coolingRun && this.#state.phase === 'cooling'
          ? this.#finishCooling()
          : undefined,
      )
      .catch((error: unknown) => {
        this.#logger.error('roast.cooling-timer-failed', { error: serializeError(error) });
      });
  }

  async #finishCooling(): Promise<void> {
    const nowMs = this.#deps.clock.now();
    this.#set({
      ...this.#state,
      phase: 'done',
      coolingEndsAtMs: null,
      events: [...this.#state.events, this.#event('cool-end', nowMs)],
    });
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
