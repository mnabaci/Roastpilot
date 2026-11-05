import type { AutoTuning, CurvePoint, PhaseHeat } from '@roastpilot/shared';
import { curveTargetC } from './curve';
import { Pid } from './pid';
import { STALL } from './stall-guard';

/** The curve's pull inside the RoR band reaches the band's edge at this far off the curve, in °C. */
const FULL_BAND_GAP_C = 2;

export interface HeatInput {
  /** Seconds since charge. */
  elapsedS: number;
  /** Seconds since the last call. */
  dtS: number;
  btC: number | undefined;
  ror: number | undefined;
  /** The stall guard is holding: a `trim` phase may add more heat. */
  stallTripped: boolean;
}

/** How one output is controlled in one phase (docs/spec/extensibility.md, Control per output). */
export interface OutputController {
  /** The heater % to ask for: not yet rounded to the roaster's step. */
  next(input: HeatInput): number;
}

/**
 * The RoR to aim for: the band's top when 2 °C or more below the curve, its bottom when 2 °C or
 * more above it, and in proportion in between.
 */
export function targetRor(band: { rorMin: number; rorMax: number }, gapC: number): number {
  const position = Math.min(1, Math.max(0, (gapC + FULL_BAND_GAP_C) / (2 * FULL_BAND_GAP_C)));
  return band.rorMax + (band.rorMin - band.rorMax) * position;
}

function fixedControl(pct: number): OutputController {
  return { next: () => pct };
}

function trimControl(
  heat: Extract<PhaseHeat, { mode: 'trim' }>,
  tuning: AutoTuning,
  curve: readonly CurvePoint[],
): OutputController {
  const pid = new Pid(tuning.trim);
  let reachedBand = false;
  let correction = 0;
  return {
    next: ({ elapsedS, dtS, btC, ror, stallTripped }) => {
      if (ror === undefined || btC === undefined) return heat.pct + correction;
      // Until RoR has reached the band, the climb out of the turning point would pin the trim.
      if (ror >= heat.rorMin) reachedBand = true;
      if (!reachedBand && !stallTripped) return heat.pct;
      const curveC = curveTargetC(curve, elapsedS);
      const target = targetRor(heat, curveC === undefined ? 0 : btC - curveC);
      const max = stallTripped ? STALL.extraHeatLimitPct : tuning.trimLimitPct;
      correction = pid.update(target - ror, dtS, { min: -tuning.trimLimitPct, max });
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
    case 'trim':
      return trimControl(heat, tuning, curve);
    case 'follow':
      return followControl(heat, tuning, curve);
  }
}
