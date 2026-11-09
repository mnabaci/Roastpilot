/** The numbers in docs/spec/roast-control.md, Stall guard. */
export const STALL = {
  tripRor: 5,
  clearRor: 6,
  lookAheadS: 60,
  /** The rate of fall counts only below this: above it, a falling RoR is the planned slow-down. */
  projectBelowRor: 8,
  /** Heat goes first: the fan is held back only after the heater has been at its limit this long. */
  heaterFirstS: 30,
  /** How much RoR history the rate of fall needs, and how much of it counts. */
  trendMinS: 45,
  trendWindowS: 60,
  fanStepPct: 5,
  fanStepEveryS: 30,
  maxFanBelowPct: 20,
  extraHeatLimitPct: 30,
} as const;

export interface StallGuardInput {
  /** Seconds since charge. */
  elapsedS: number;
  ror: number | undefined;
  /** What the phase plans for the fan now. */
  plannedFanPct: number;
  /** After your first-crack tap the guard stands down: a low RoR is normal then. */
  firstCracked: boolean;
  /** The heater can add no more: at 100 %, or its correction at the limit. */
  heaterMaxed: boolean;
}

export interface StallGuardOutput {
  tripped: boolean;
  /** The fan to send: the plan, or less while the guard holds it back. */
  fanPct: number;
}

/**
 * Keeps a roast from stalling before first crack: when RoR is low or falling towards it, the PID
 * may add more heat, and only once the heater is spent is the fan held back, since smoke builds
 * near the end. Run from the end of the soak, once per reading.
 */
export class StallGuard {
  readonly #history: { atS: number; ror: number }[] = [];
  #armed = false;
  #tripped = false;
  /** Set while the fan is held or on its way back up. */
  #fan: { level: number; floor: number; lastStepS: number } | undefined;
  /** When the heater reached its limit during this trip; undefined while it has more to give. */
  #maxedSinceS: number | undefined;

  update(input: StallGuardInput): StallGuardOutput {
    const { elapsedS, ror, plannedFanPct, firstCracked, heaterMaxed } = input;
    if (ror !== undefined && Number.isFinite(ror)) this.#remember(elapsedS, ror);
    this.#tripped = !firstCracked && this.#nextTripped(elapsedS, ror);
    this.#maxedSinceS = this.#tripped && heaterMaxed ? (this.#maxedSinceS ?? elapsedS) : undefined;
    return { tripped: this.#tripped, fanPct: this.#fanFor(elapsedS, plannedFanPct) };
  }

  #remember(atS: number, ror: number): void {
    this.#history.push({ atS, ror });
    while ((this.#history[0]?.atS ?? atS) < atS - STALL.trendWindowS) this.#history.shift();
    if (ror >= STALL.tripRor) this.#armed = true;
  }

  #nextTripped(elapsedS: number, ror: number | undefined): boolean {
    if (!this.#armed || ror === undefined) return this.#tripped;
    const inAMinute = ror + this.#rorChangePerS(elapsedS) * STALL.lookAheadS;
    const fallingTowards = ror < STALL.projectBelowRor && inAMinute < STALL.tripRor;
    if (this.#tripped) return ror < STALL.clearRor || fallingTowards;
    return ror < STALL.tripRor || fallingTowards;
  }

  /** How fast RoR has moved over the window; 0 until there is enough history, or if rising. */
  #rorChangePerS(elapsedS: number): number {
    const oldest = this.#history[0];
    const newest = this.#history.at(-1);
    if (!oldest || !newest || elapsedS - oldest.atS < STALL.trendMinS) return 0;
    return Math.min(0, (newest.ror - oldest.ror) / (newest.atS - oldest.atS));
  }

  #fanFor(elapsedS: number, plannedFanPct: number): number {
    const heatSpent =
      this.#maxedSinceS !== undefined && elapsedS - this.#maxedSinceS >= STALL.heaterFirstS;
    if (heatSpent && !this.#fan) {
      // The first step comes now: the heater has already had its turn.
      this.#fan = {
        level: plannedFanPct,
        floor: plannedFanPct - STALL.maxFanBelowPct,
        lastStepS: elapsedS - STALL.fanStepEveryS,
      };
    }
    const fan = this.#fan;
    if (!fan) return plannedFanPct;
    if (elapsedS - fan.lastStepS >= STALL.fanStepEveryS) {
      fan.lastStepS = elapsedS;
      const step = this.#tripped ? -STALL.fanStepPct : STALL.fanStepPct;
      fan.level = Math.max(fan.floor, fan.level + step);
    }
    if (!this.#tripped && fan.level >= plannedFanPct) {
      this.#fan = undefined;
      return plannedFanPct;
    }
    return Math.max(0, Math.min(plannedFanPct, fan.level));
  }
}
