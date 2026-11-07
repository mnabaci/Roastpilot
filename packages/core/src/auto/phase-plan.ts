import type { AutoProfile, ProfilePhase } from '@roastpilot/shared';

export interface PhaseClock {
  /** Seconds since charge. */
  elapsedS: number;
  /** The latest temperature; undefined when there is no valid reading. */
  btC: number | undefined;
}

/** Whether this phase's trigger or backup has fired (docs/spec/roast-control.md, Profile format). */
function phaseIsOver(phase: ProfilePhase, { elapsedS, btC }: PhaseClock): boolean {
  const { next } = phase;
  if (next.on === 'time') return elapsedS >= next.afterS;
  if (next.on === 'bt') return elapsedS >= next.backupS || (btC !== undefined && btC >= next.c);
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

/** The profile with its opening soak set to `soakS`: a fixed phase that ends on time. */
export function withSoakTime(profile: AutoProfile, soakS: number): AutoProfile {
  return {
    ...profile,
    phases: profile.phases.map((phase, index) =>
      index === 0 && phase.heat.mode === 'fixed' && phase.next.on === 'time'
        ? { ...phase, next: { on: 'time', afterS: soakS } }
        : phase,
    ),
  };
}

/**
 * Whether dry end has come. The temperature starts above it at charge and falls through it, so it
 * only counts after the soak, once the roast is climbing.
 */
export function dryEndReached(
  profile: AutoProfile,
  phaseIndex: number,
  btC: number | undefined,
): boolean {
  return phaseIndex > 0 && btC !== undefined && btC >= profile.dryEndC;
}
