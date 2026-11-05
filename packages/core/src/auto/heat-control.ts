import type { AutoTuning, CurvePoint, PhaseHeat } from '@roastpilot/shared';
import { curveTargetC } from './curve';
import { Pid } from './pid';
import { STALL } from './stall-guard';

export interface HeatInput {
  /** Seconds since charge. */
  elapsedS: number;
  /** Seconds since this phase began. */
  phaseElapsedS: number;
  /** Seconds since the last call. */
  dtS: number;
  btC: number | undefined;
  ror: number | undefined;
  /** The stall guard is holding: a `target` phase may add more heat. */
  stallTripped: boolean;
}

/** How one output is controlled in one phase (docs/spec/extensibility.md, Control per output). */
export interface OutputController {
  /** The heater % to ask for: not yet rounded to the roaster's step. */
  next(input: HeatInput): number;
}

type TargetHeat = Extract<PhaseHeat, { mode: 'target' }>;

/**
 * The RoR this step needs now: the temperature still to gain over the time left, kept inside its
 * range. Out of time and short, the top of the range; at or past the end, the bottom.
 */
export function neededRor(heat: TargetHeat, btC: number, phaseElapsedS: number): number {
  const toGainC = heat.endC - btC;
  if (toGainC <= 0) return heat.rorMin;
  const leftS = heat.durationS - phaseElapsedS;
  if (leftS <= 0) return heat.rorMax;
  const needed = (toGainC / leftS) * 60;
  return Math.min(heat.rorMax, Math.max(heat.rorMin, needed));
}

function fixedControl(pct: number): OutputController {
  return { next: () => pct };
}

function targetControl(heat: TargetHeat, tuning: AutoTuning): OutputController {
  const pid = new Pid(tuning.target);
  let reachedRange = false;
  let correction = 0;
  return {
    next: ({ phaseElapsedS, dtS, btC, ror, stallTripped }) => {
      if (ror === undefined || btC === undefined) return heat.pct + correction;
      // Until RoR has reached the range, the climb out of the turning point would pin the PID.
      if (ror >= heat.rorMin) reachedRange = true;
      if (!reachedRange && !stallTripped) return heat.pct;
      const max = stallTripped ? STALL.extraHeatLimitPct : tuning.targetLimitPct;
      const error = neededRor(heat, btC, phaseElapsedS) - ror;
      correction = pid.update(error, dtS, { min: -tuning.targetLimitPct, max });
      return heat.pct + correction;
    },
  };
}

function followControl(
  heat: Extract<PhaseHeat, { mode: 'follow' }>,
  tuning: AutoTuning,
  curve: readonly CurvePoint[],
): OutputController {
  const pid = new Pid(tuning.follow);
  // Around its starting value, so the heater doesn't jump as the phase begins.
  const limits = { min: -heat.pct, max: 100 - heat.pct };
  let last = heat.pct;
  return {
    next: ({ elapsedS, dtS, btC }) => {
      const curveC = curveTargetC(curve, elapsedS);
      if (btC === undefined || curveC === undefined) return last;
      last = heat.pct + pid.update(curveC - btC, dtS, limits);
      return last;
    },
  };
}

/** The controller for one phase's heat mode; a new one for each phase, so nothing carries over. */
export function heatControlFor(
  heat: PhaseHeat,
  tuning: AutoTuning,
  curve: readonly CurvePoint[],
): OutputController {
  switch (heat.mode) {
    case 'fixed':
      return fixedControl(heat.pct);
    case 'target':
      return targetControl(heat, tuning);
    case 'follow':
      return followControl(heat, tuning, curve);
  }
}
