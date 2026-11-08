import type { AutoProfile, ProfilePhase } from '@roastpilot/shared';

export interface PhaseClock {
  /** Seconds since charge. */
  elapsedS: number;
  /** The latest temperature; undefined when there is no valid reading. */
  btC: number | undefined;
  /** The lowest temperature since charge; undefined before the first valid reading. */
  lowestC: number | undefined;
}

/**
 * Whether BT has climbed to `c`. It starts above most triggers at charge and falls through them,
 * so a temperature only counts once BT has been below it: with or without a soak.
 */
function climbedTo({ btC, lowestC }: PhaseClock, c: number): boolean {
  return btC !== undefined && lowestC !== undefined && lowestC < c && btC >= c;
}

/** Whether this phase's trigger or backup has fired (docs/spec/roast-control.md, Profile format). */
function phaseIsOver(phase: ProfilePhase, clock: PhaseClock): boolean {
  const { next } = phase;
  if (next.on === 'time') return clock.elapsedS >= next.afterS;
  if (next.on === 'bt') return clock.elapsedS >= next.backupS || climbedTo(clock, next.c);
  return false;
}

/**
 * The phase to run now, given the one running. One step per call and never backwards, so every
 * phase's heat and fan are sent even if two triggers fire close together.
 */
export function advancePhase(profile: AutoProfile, index: number, clock: PhaseClock): number {
  const phase = profile.phases[index];
  if (!phase || !phaseIsOver(phase, clock)) return index;
  return Math.min(index + 1, profile.phases.length - 1);
}

/** Auto drops at least this far below the roaster's max temperature, so Drop comes before a safety stop. */
export const CAP_BELOW_MAX_C = 5;

/** The profile with its BT cap under the roaster's max temperature (docs/spec/roast-control.md). */
export function withCapUnder(profile: AutoProfile, maxTempC: number): AutoProfile {
  const capC = Math.min(profile.capC, maxTempC - CAP_BELOW_MAX_C);
  return capC === profile.capC ? profile : { ...profile, capC };
}

/** The opening soak: a profile's first phase, when it holds the heater fixed after charge. */
export function isSoak(profile: AutoProfile, phaseIndex: number): boolean {
  return phaseIndex === 0 && profile.phases[0]?.heat.mode === 'fixed';
}

/** Whether dry end has come: BT has climbed back to it after charge, and never in the soak. */
export function dryEndReached(
  profile: AutoProfile,
  phaseIndex: number,
  clock: PhaseClock,
): boolean {
  return !isSoak(profile, phaseIndex) && climbedTo(clock, profile.dryEndC);
}

/** How long the opening soak runs, in seconds; 0 for a profile that starts without one. */
export function soakLengthS(profile: AutoProfile): number {
  const [first] = profile.phases;
  return isSoak(profile, 0) && first?.next.on === 'time' ? first.next.afterS : 0;
}

/** The profile with its opening soak set to `soakS`: a fixed phase that ends on time. */
export function withSoakTime(profile: AutoProfile, soakS: number): AutoProfile {
  return {
    ...profile,
    phases: profile.phases.map((phase, index) =>
      isSoak(profile, index) && phase.next.on === 'time'
        ? { ...phase, next: { on: 'time', afterS: soakS } }
        : phase,
    ),
  };
}
