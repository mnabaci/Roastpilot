import type { AutoProfile, Reading, RoastState } from '@roastpilot/shared';
import type { RoastRun } from '../auto/roast-run';
import type { CoachInput, CoachOutputs } from './coach-rule';

/** Where Auto's phase began, as the coach saw it; `atMs` is undefined for one it caught up into. */
export interface PhaseSeen {
  index: number;
  atMs: number | undefined;
  btC: number | undefined;
}

export interface CoachInputParts {
  run: RoastRun;
  profile: AutoProfile;
  roast: RoastState;
  reading: Reading;
  now: Pick<CoachInput, 'btC' | 'ror' | 'trend'>;
  set: CoachOutputs<number | undefined>;
  wants: CoachOutputs<number>;
  phaseSeen: PhaseSeen | undefined;
  expectedFirstCrackC: number | undefined;
}

/** What the rules read this reading. */
export function coachInput(parts: CoachInputParts): CoachInput {
  const { run, profile, roast, reading } = parts;
  const seen = parts.phaseSeen?.index === run.phaseIndex ? parts.phaseSeen : undefined;
  return {
    roastPhase: roast.phase === 'development' ? 'development' : 'roasting',
    nowMs: reading.atMs,
    elapsedS: (reading.atMs - run.chargedAtMs) / 1_000,
    ...parts.now,
    firstCrackAtMs: roast.firstCrackAtMs,
    profile,
    step: {
      index: run.phaseIndex,
      phase: profile.phases[run.phaseIndex],
      startC: seen?.btC,
      newForS: seen?.atMs === undefined ? undefined : (reading.atMs - seen.atMs) / 1_000,
      stallTripped: run.stallTripped,
    },
    set: parts.set,
    wants: parts.wants,
    expectedFirstCrackC: parts.expectedFirstCrackC,
  };
}

/** How far Auto's setting is from yours, per output; 0 for an output the roaster hasn't reported. */
export const gapsOf = ({
  set,
  wants,
}: Pick<CoachInput, 'set' | 'wants'>): CoachOutputs<number> => ({
  heater: set.heater === undefined ? 0 : Math.abs(wants.heater - set.heater),
  fan: set.fan === undefined ? 0 : Math.abs(wants.fan - set.fan),
});
