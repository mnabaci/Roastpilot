import type { AutoProfile, AutoStatus, AutoTuning, PreheatStep } from '@roastpilot/shared';
import { Pid } from './pid';
import type { PreheatHold } from './preheat-hold';

/** The numbers in docs/spec/roast-control.md, Roast phases end to end. */
export const PREHEAT = {
  coolIfAboveChargeByC: -10,
  coolToBelowChargeC: 20,
  /** Close enough to charge temperature for the hold to start counting. */
  holdWithinC: 1,
  stepLimitMs: 15 * 60_000,
  waitingLimitMs: 10 * 60_000,
  beansInWaitMs: 30_000,
} as const;

export interface PreheatOutputs {
  heaterPct: number;
  fanPct: number;
  /** A limit ran out: Auto should stop and hand the outputs to you. */
  gaveUp: boolean;
}

/** The between-batch preheat: cool if hot, climb, hold, then wait for the beans. */
export class PreheatProtocol {
  readonly #chargeC: number;
  readonly #tuning: AutoTuning;
  readonly #pid: Pid;
  #step: PreheatStep | undefined;
  #stepStartedMs = 0;
  #waitingSinceMs = 0;
  #lastMs: number | undefined;
  #nowMs = 0;
  readonly #hold: PreheatHold;
  #chosenS: number | null;

  /** `hold`: picked for the batch; `chosenS`: this roast's own choice, if you made one. */
  constructor(profile: AutoProfile, tuning: AutoTuning, hold: PreheatHold, chosenS: number | null) {
    this.#chargeC = profile.chargeC;
    this.#tuning = tuning;
    this.#pid = new Pid(tuning.preheat);
    this.#hold = hold;
    this.#chosenS = chosenS;
  }

  /** The hold this preheat runs, for the status. */
  get hold(): NonNullable<AutoStatus['preheatHold']> {
    return { s: this.#holdS, batch: this.#hold.batch, chosen: this.#chosenS !== null };
  }

  /**
   * Your choice for this roast, or null for the batch's: a running hold counts what it has held
   * already, so a shorter choice ends it now, never earlier than that.
   */
  choose(holdS: number | null): void {
    this.#chosenS = holdS;
  }

  get #holdS(): number {
    return this.#chosenS ?? this.#hold.s;
  }

  get step(): PreheatStep | null {
    return this.#step ?? null;
  }

  /** Seconds left on the hold or the charge countdown; null in the other steps. */
  get leftS(): number | null {
    const left = (seconds: number) =>
      Math.max(0, Math.ceil(seconds - (this.#nowMs - this.#stepStartedMs) / 1_000));
    if (this.#step === 'hold') return left(this.#holdS);
    if (this.#step === 'charge-cut') return left(this.#tuning.chargeCutS);
    return null;
  }

  /** Charge soon: only from "Add beans". Returns whether it started the countdown. */
  chargeSoon(nowMs: number): boolean {
    if (this.#step !== 'add-beans') return false;
    this.#enter('charge-cut', nowMs);
    return true;
  }

  next(nowMs: number, btC: number | undefined): PreheatOutputs {
    const dtS = this.#lastMs === undefined ? 0 : (nowMs - this.#lastMs) / 1_000;
    this.#lastMs = nowMs;
    this.#nowMs = nowMs;
    if (this.#step === undefined) this.#begin(nowMs, btC);
    this.#advance(nowMs, btC);
    const off = { heaterPct: 0, fanPct: this.#tuning.preheatFanPct };
    if (this.#expired(nowMs)) return { ...off, gaveUp: true };
    if (this.#step === 'cool') return { heaterPct: 0, fanPct: 100, gaveUp: false };
    if (this.#step === 'charge-cut' || this.#step === 'beans-in' || btC === undefined) {
      return { ...off, gaveUp: false };
    }
    const heaterPct = this.#pid.update(this.#chargeC - btC, dtS, { min: 0, max: 100 });
    return { heaterPct, fanPct: this.#tuning.preheatFanPct, gaveUp: false };
  }

  #begin(nowMs: number, btC: number | undefined): void {
    const hot = btC !== undefined && btC > this.#chargeC + PREHEAT.coolIfAboveChargeByC;
    this.#enter(hot ? 'cool' : 'climb', nowMs);
  }

  #advance(nowMs: number, btC: number | undefined): void {
    const stepMs = nowMs - this.#stepStartedMs;
    if (this.#step === 'cool') {
      if (btC !== undefined && btC <= this.#chargeC - PREHEAT.coolToBelowChargeC) {
        this.#enter('climb', nowMs);
      }
    } else if (this.#step === 'climb') {
      if (btC !== undefined && btC >= this.#chargeC - PREHEAT.holdWithinC) {
        this.#enter('hold', nowMs);
      }
    } else if (this.#step === 'hold') {
      if (stepMs >= this.#holdS * 1_000) {
        this.#waitingSinceMs = nowMs;
        this.#enter('add-beans', nowMs);
      }
    } else if (this.#step === 'charge-cut') {
      if (stepMs >= this.#tuning.chargeCutS * 1_000) this.#enter('beans-in', nowMs);
    } else if (this.#step === 'beans-in') {
      if (stepMs >= PREHEAT.beansInWaitMs) this.#enter('add-beans', nowMs);
    }
  }

  #expired(nowMs: number): boolean {
    if (this.#step === 'cool' || this.#step === 'climb') {
      return nowMs - this.#stepStartedMs >= PREHEAT.stepLimitMs;
    }
    if (this.#step === 'hold') return false;
    return nowMs - this.#waitingSinceMs >= PREHEAT.waitingLimitMs;
  }

  #enter(step: PreheatStep, nowMs: number): void {
    this.#step = step;
    this.#stepStartedMs = nowMs;
  }
}
