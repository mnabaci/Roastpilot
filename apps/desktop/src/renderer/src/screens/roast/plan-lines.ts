import { curveTargetC, followAimRor, STALL } from '@roastpilot/core';
import type { AutoProfile, CurveFollow, CurvePoint } from '@roastpilot/shared';

/**
 * How far BT is from the dashed plan now: "−4 °C vs plan", or "On plan". Only from the plan's
 * turning point on: before it the drop after charge differs from roast to roast and means nothing.
 */
export function planLine(
  plan: readonly CurvePoint[],
  elapsedS: number,
  btC: number,
): string | undefined {
  const turningPoint = plan.reduce<CurvePoint | undefined>(
    (low, p) => (low === undefined || p.c < low.c ? p : low),
    undefined,
  );
  if (!turningPoint || elapsedS < turningPoint.tS) return undefined;
  const planC = curveTargetC(plan, elapsedS);
  if (planC === undefined) return undefined;
  const deltaC = Math.round(btC - planC);
  if (deltaC === 0) return 'On plan';
  return `${deltaC > 0 ? '+' : '−'}${String(Math.abs(deltaC))} °C vs plan`;
}

export interface AimInput {
  phaseName: string | null;
  firstCracked: boolean;
  /** For a curve phase: seconds since charge, BT and the roaster's curve following. */
  elapsedS?: number;
  btC?: number;
  curveFollow?: CurveFollow;
}

/**
 * The RoR the running phase aims for: a step's range, "Aim 12–14", or a curve phase's one number
 * now, "Aim 12", worked out as Auto does. Until your first-crack tap nothing aims below the stall
 * guard's 5 °C/min (docs/spec/roast-control.md).
 */
export function rorAimLine(profile: AutoProfile, input: AimInput): string | undefined {
  const { phaseName, firstCracked, elapsedS, btC, curveFollow } = input;
  const heat = profile.phases.find((p) => p.name === phaseName)?.heat;
  if (heat?.mode === 'follow') {
    if (elapsedS === undefined || btC === undefined || !curveFollow) return undefined;
    const aim = followAimRor(profile.curve, curveFollow, { elapsedS, btC, firstCracked });
    return aim === undefined ? undefined : `Aim ${String(Math.round(aim))}`;
  }
  if (heat?.mode !== 'target') return undefined;
  const { rorMin, rorMax } = heat;
  const min = firstCracked ? rorMin : Math.min(rorMax, Math.max(rorMin, STALL.tripRor));
  return min === rorMax ? `Aim ${String(min)}` : `Aim ${String(min)}–${String(rorMax)}`;
}
