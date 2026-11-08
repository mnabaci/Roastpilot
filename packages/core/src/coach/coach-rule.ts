import type { AutoProfile, CoachAdvice, ProfilePhase } from '@roastpilot/shared';
import type { RorTrend } from './ror-trend';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Advice before the card gives it an id. */
export type CoachTip = WithoutId<CoachAdvice>;

/** Heater and fan: what is set (undefined until the roaster reports it) or what Auto wants. */
export interface CoachOutputs<T> {
  heater: T;
  fan: T;
}

/** Auto's phase, as the background run has it. */
export interface CoachStep {
  /** Its place in the profile: a new phase is a new number. */
  index: number;
  phase: ProfilePhase | undefined;
  /** The opening soak: Auto's own way to start, not advice for a manual charge. */
  soak: boolean;
  /** BT when it began, when the coach saw it begin. */
  startC: number | undefined;
  /** Seconds since the coach saw it begin; undefined for a phase it caught up into. */
  newForS: number | undefined;
  stallTripped: boolean;
}

/** What a rule reads: one reading of a manual roast, with Auto running beside it. */
export interface CoachInput {
  roastPhase: 'roasting' | 'development';
  nowMs: number;
  /** Seconds since charge. */
  elapsedS: number;
  btC: number | undefined;
  ror: number | undefined;
  trend: RorTrend | undefined;
  firstCrackAtMs: number | null;
  profile: AutoProfile;
  step: CoachStep;
  set: CoachOutputs<number | undefined>;
  /** What Auto would set now, rounded as the roaster takes it. */
  wants: CoachOutputs<number>;
  /** As for the Listen for first crack sound; undefined without saved first cracks. */
  expectedFirstCrackC: number | undefined;
}

/**
 * One kind of tip on the coach card (docs/spec/extensibility.md, Manual coach). Rules run in order
 * and the first with something to say wins, unless you dismissed that.
 */
export interface CoachRule {
  readonly id: string;
  advise(input: CoachInput): CoachTip | undefined;
}
