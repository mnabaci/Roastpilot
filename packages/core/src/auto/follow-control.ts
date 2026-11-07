import type { CurveFollow, CurvePoint, PhaseHeat } from '@roastpilot/shared';
import { curveRorAt, curveTargetC } from './curve';
import { FULL_PCT, type OutputController } from './output-controller';
import { Pid } from './pid';
import { STALL } from './stall-guard';

/** The RoR a curve phase may aim for, in °C/min: never a fall, never a runaway. */
export const FOLLOW_AIM_ROR = { min: 0, max: 30 } as const;

export interface FollowAimInput {
  /** Seconds since charge. */
  elapsedS: number;
  /** Settled BT. */
  btC: number;
  firstCracked: boolean;
}

/**
 * The RoR a curve phase aims for now (docs/spec/roast-control.md, Heat control): the curve's own RoR
 * `lookAheadS` ahead, plus `pullPerC` for each °C BT is behind the curve (less when ahead), kept in
 * range and, until your first-crack tap, never below the stall guard's. Undefined with no curve.
 */
export function followAimRor(
  curve: readonly CurvePoint[],
  tuning: Pick<CurveFollow, 'lookAheadS' | 'pullPerC'>,
  { elapsedS, btC, firstCracked }: FollowAimInput,
): number | undefined {
  const curveC = curveTargetC(curve, elapsedS);
  const curveRor = curveRorAt(curve, elapsedS + tuning.lookAheadS);
  if (curveC === undefined || curveRor === undefined || !Number.isFinite(btC)) return undefined;
  const aim = curveRor + tuning.pullPerC * (curveC - btC);
  const floor = firstCracked ? FOLLOW_AIM_ROR.min : STALL.tripRor;
  return Math.min(FOLLOW_AIM_ROR.max, Math.max(floor, aim));
}

/** `from` moved towards `to` by at most `maxStep`. */
function slew(from: number, to: number, maxStep: number): number {
  return Math.min(from + maxStep, Math.max(from - maxStep, to));
}

/**
 * A curve phase: starts from its heat estimate, and a RoR PID trims it within its limit to hold
 * the aim, the heater moving at most `slewPctPer10s` per 10 s either way (ADR 0016).
 */
export function followControl(
  heat: Extract<PhaseHeat, { mode: 'follow' }>,
  tuning: CurveFollow,
  curve: readonly CurvePoint[],
): OutputController {
  const pid = new Pid(tuning.gains);
  let heater = heat.pct;
  let ceiling = Math.min(FULL_PCT, heat.pct + tuning.limitPct);
  let reachedAim = false;
  return {
    get maxed() {
      return heater >= ceiling;
    },
    next: ({ elapsedS, dtS, btC, ror, stallTripped, firstCracked }) => {
      if (ror === undefined || !Number.isFinite(ror) || btC === undefined) return heater;
      const aim = followAimRor(curve, tuning, { elapsedS, btC, firstCracked });
      if (aim === undefined) return heater;
      // The climb out of the turning point would pin the correction: it waits for RoR to arrive.
      if (ror >= Math.min(aim, STALL.tripRor)) reachedAim = true;
      const max = stallTripped
        ? Math.max(tuning.limitPct, STALL.extraHeatLimitPct)
        : tuning.limitPct;
      ceiling = Math.min(FULL_PCT, heat.pct + max);
      const correction =
        reachedAim || stallTripped ? pid.update(aim - ror, dtS, { min: -tuning.limitPct, max }) : 0;
      const wanted = Math.min(FULL_PCT, Math.max(0, heat.pct + correction));
      const stepS = Number.isFinite(dtS) && dtS > 0 ? dtS : 0;
      heater = slew(heater, wanted, (tuning.slewPctPer10s * stepS) / 10);
      return heater;
    },
  };
}
