import {
  err,
  ok,
  type AcknowledgeError,
  type Reading,
  type Result,
  type SafetyEvent,
} from '@roastpilot/shared';
import type { Clock } from '../clock';
import { guardListener } from '../logging/guard-listener';
import { silentLogger, type Logger } from '../logging/logger';
import { serializeError } from '../logging/serialize-error';
import type { DriverError } from '../roaster-driver';
import { DEFAULT_SAFETY_LIMITS, type SafetyLimits } from './safety-limits';
import { BEAN_TEMP, type SafetyRule, type SafetyState } from './safety-rule';
import { lostConnectionRule } from './rules/lost-connection';
import { SAFETY_RULES } from './rules';

export type { SafetyEvent } from '@roastpilot/shared';

export interface SafetyMonitorOptions {
  clock: Clock;
  /** The real driver's safe stop. Must never reject (RoasterDriver contract). */
  safeStop: () => Promise<void>;
  onEvent: (event: SafetyEvent) => void;
  /** A function is read on every check, so a change of roaster applies. */
  limits?: SafetyLimits | (() => SafetyLimits);
  logger?: Logger;
}

export const EMERGENCY_STOP = 'emergency-stop';
/** The computer is about to sleep: nothing would watch the roaster (docs/spec/safety.md). */
export const COMPUTER_SLEEP = 'computer-sleep';

/** Keeps a little more than the longest rule window, so a window always has a reading at its start. */
const HISTORY_MARGIN_MS = 5_000;

/** Watches every reading, trips the rules in docs/spec/safety.md and holds the heater lock. */
export class SafetyMonitor {
  readonly #clock: Clock;
  readonly #safeStop: () => Promise<void>;
  readonly #onEvent: (event: SafetyEvent) => void;
  readonly #readLimits: () => SafetyLimits;
  readonly #logger: Logger;
  readonly #tripped = new Set<string>();
  #history: Reading[] = [];
  #armed = false;
  #lastValidReadingMs: number | undefined;
  #roastStartedMs: number | undefined;
  #turningPointMs: number | undefined;
  #locked = false;

  constructor(options: SafetyMonitorOptions) {
    this.#clock = options.clock;
    this.#safeStop = options.safeStop;
    const { limits = DEFAULT_SAFETY_LIMITS } = options;
    this.#readLimits = typeof limits === 'function' ? limits : () => limits;
    this.#logger = options.logger ?? silentLogger;
    // A listener that throws must never skip the safe stop or the lock that follow its event.
    this.#onEvent = guardListener(this.#logger, 'safety.listener-failed', options.onEvent);
  }

  /** True after a safe-stop trip until acknowledged: heater commands above 0 are refused. */
  get locked(): boolean {
    return this.#locked;
  }

  /** Ids of the rules tripped right now. */
  get tripped(): readonly string[] {
    return [...this.#tripped];
  }

  /** A deliberate disconnect: lost connection is disarmed until the next connect. */
  disconnected(): void {
    this.#armed = false;
    this.check();
  }

  /**
   * The red button, or another stop from outside the rules (`rule`, e.g. computer sleep): same as a
   * safe-stop trip, but it holds nothing, so you can acknowledge at once.
   */
  emergencyStop(rule: typeof EMERGENCY_STOP | typeof COMPUTER_SLEEP = EMERGENCY_STOP): void {
    this.#onEvent({
      kind: 'tripped',
      rule,
      action: 'safe-stop',
      atMs: this.#clock.now(),
    });
    this.#locked = true;
    this.#stop();
  }

  connected(): void {
    // Only an arming connect starts the clock. A reconnect is not a reading: lost connection stays
    // tripped until real readings return, which is what sends the second safe stop.
    if (!this.#armed) {
      this.#armed = true;
      this.#lastValidReadingMs = this.#clock.now();
    }
    this.check();
  }

  recordRead(result: Result<Reading, DriverError>): void {
    if (result.ok && Number.isFinite(result.value.values[BEAN_TEMP])) {
      this.#lastValidReadingMs = this.#clock.now();
      this.#history.push(result.value);
      this.#pruneHistory();
      // Readings are back after a lost connection: the earlier safe stop may not have arrived.
      if (this.#tripped.has(lostConnectionRule.id)) this.#stop();
    }
    this.check();
  }

  /** Charge; `atMs` is the charge point when it was found before the press. */
  roastStarted(atMs: number = this.#clock.now()): void {
    this.#roastStartedMs = atMs;
    this.#turningPointMs = undefined;
    this.check();
  }

  /** The turning point: BT rises again, so a stall counts from here. */
  turningPoint(atMs: number = this.#clock.now()): void {
    this.#turningPointMs = atMs;
    this.check();
  }

  roastEnded(): void {
    this.#roastStartedMs = undefined;
    this.#turningPointMs = undefined;
    this.check();
  }

  /** Lifts the heater lock, unless a safe-stop rule is still tripped. */
  acknowledge(): Result<void, AcknowledgeError> {
    this.check();
    const stillTripped = SAFETY_RULES.filter(
      (r) => r.action === 'safe-stop' && this.#tripped.has(r.id),
    ).map((r) => r.id);
    if (stillTripped.length > 0) return err({ kind: 'still-tripped', rules: stillTripped });
    if (this.#locked) {
      this.#locked = false;
      this.#onEvent({ kind: 'unlocked', atMs: this.#clock.now() });
    }
    return ok(undefined);
  }

  /** Runs every rule now. Called on each reading and by the app's own 1 s timer. */
  check(): void {
    const state = this.#state();
    for (const rule of SAFETY_RULES) {
      const isTripped = this.#evaluate(rule, state);
      const wasTripped = this.#tripped.has(rule.id);
      if (isTripped && !wasTripped) {
        this.#tripped.add(rule.id);
        this.#onEvent({ kind: 'tripped', rule: rule.id, action: rule.action, atMs: state.nowMs });
        if (rule.action === 'safe-stop') {
          this.#locked = true;
          this.#stop();
        }
      } else if (!isTripped && wasTripped) {
        this.#tripped.delete(rule.id);
        this.#onEvent({ kind: 'cleared', rule: rule.id, atMs: state.nowMs });
      }
    }
  }

  /** A rule that throws is a bug in safety code: fail safe by treating it as tripped. */
  #evaluate(rule: SafetyRule, state: SafetyState): boolean {
    try {
      return rule.isTripped(state, this.#readLimits());
    } catch (error) {
      this.#logger.error('safety.rule-failed', { rule: rule.id, error: serializeError(error) });
      return true;
    }
  }

  #state(): SafetyState {
    return {
      nowMs: this.#clock.now(),
      armed: this.#armed,
      lastValidReadingMs: this.#lastValidReadingMs,
      history: this.#history,
      roastStartedMs: this.#roastStartedMs,
      turningPointMs: this.#turningPointMs,
    };
  }

  /** Read from the current limits, so a roaster with longer windows still gets a full one. */
  #pruneHistory(): void {
    const { slowRise, frozenReadingMs } = this.#readLimits();
    const historyMs = Math.max(slowRise.windowMs, frozenReadingMs) + HISTORY_MARGIN_MS;
    const cutoffMs = this.#clock.now() - historyMs;
    const firstKept = this.#history.findIndex((r) => r.atMs >= cutoffMs);
    if (firstKept > 0) this.#history = this.#history.slice(firstKept);
  }

  #stop(): void {
    this.#safeStop().catch((error: unknown) => {
      // Contract says safeStop never rejects; if one does, the sketch watchdog is the backstop.
      this.#logger.error('safety.safe-stop-rejected', { error: serializeError(error) });
    });
  }
}
