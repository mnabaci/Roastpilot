export interface HeatInput {
  /** Seconds since charge. */
  elapsedS: number;
  /** Seconds since this phase began. */
  phaseElapsedS: number;
  /** Seconds since the last call. */
  dtS: number;
  btC: number | undefined;
  ror: number | undefined;
  /** The stall guard is holding: the correction may add more heat. */
  stallTripped: boolean;
  /** Your first-crack tap: until then no phase aims below the stall guard's RoR. */
  firstCracked: boolean;
}

/** How one output is controlled in one phase (docs/spec/extensibility.md, Control per output). */
export interface OutputController {
  /** The heater % to ask for: not yet rounded to the roaster's step. */
  next(input: HeatInput): number;
  /** The last `next` could add no more heat, so the stall guard may turn to the fan. */
  readonly maxed: boolean;
}

export const FULL_PCT = 100;
