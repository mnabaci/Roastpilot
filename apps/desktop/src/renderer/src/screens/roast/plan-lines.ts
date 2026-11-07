import { curveTargetC, STALL } from '@roastpilot/core';
import type { AutoProfile, CurvePoint } from '@roastpilot/shared';

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

/**
 * The RoR the running step aims for: "Aim 12–14". Until your first-crack tap no step aims below
 * the stall guard's 5 °C/min (docs/spec/roast-control.md); a curve phase aims for no RoR.
 */
export function rorAimLine(
  profile: AutoProfile,
  phaseName: string | null,
  firstCracked: boolean,
): string | undefined {
  const heat = profile.phases.find((p) => p.name === phaseName)?.heat;
  if (heat?.mode !== 'target') return undefined;
  const { rorMin, rorMax } = heat;
  const min = firstCracked ? rorMin : Math.min(rorMax, Math.max(rorMin, STALL.tripRor));
  return min === rorMax ? `Aim ${String(min)}` : `Aim ${String(min)}–${String(rorMax)}`;
}
