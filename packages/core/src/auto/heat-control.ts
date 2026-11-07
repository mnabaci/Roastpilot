import type { AutoTuning, CurvePoint, PhaseHeat } from '@roastpilot/shared';
import { followControl } from './follow-control';
import { FULL_PCT, type OutputController } from './output-controller';
import { Pid } from './pid';
import { STALL } from './stall-guard';

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
  // A fixed step never adds heat of its own.
  return { next: () => pct, maxed: true };
}

function targetControl(heat: TargetHeat, tuning: AutoTuning): OutputController {
  const pid = new Pid(tuning.target);
  let reachedRange = false;
  let correction = 0;
  let max = tuning.targetLimitPct;
  return {
    get maxed() {
      return correction >= max || heat.pct + correction >= FULL_PCT;
    },
    next: ({ phaseElapsedS, dtS, btC, ror, stallTripped, firstCracked }) => {
      if (ror === undefined || btC === undefined) return heat.pct + correction;
      // Until RoR has reached the range, the climb out of the turning point would pin the PID.
      if (ror >= heat.rorMin) reachedRange = true;
      if (!reachedRange && !stallTripped) return heat.pct;
      max = stallTripped ? STALL.extraHeatLimitPct : tuning.targetLimitPct;
      const needed = neededRor(heat, btC, phaseElapsedS);
      const aim = firstCracked ? needed : Math.max(needed, STALL.tripRor);
      correction = pid.update(aim - ror, dtS, { min: -tuning.targetLimitPct, max });
      return heat.pct + correction;
    },
  };
}

/**
 * The controller for one phase's heat mode; a new one for each phase. Only a curve phase after
 * another takes `fromPct`, the heater the last one left, so the change between them is slewed too.
 */
export function heatControlFor(
  heat: PhaseHeat,
  tuning: AutoTuning,
  curve: readonly CurvePoint[],
  fromPct?: number,
): OutputController {
  switch (heat.mode) {
    case 'fixed':
      return fixedControl(heat.pct);
    case 'target':
      return targetControl(heat, tuning);
    case 'follow':
      return followControl(heat, tuning.curveFollow, curve, fromPct);
  }
}
