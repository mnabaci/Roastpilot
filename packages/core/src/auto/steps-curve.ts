import type { AutoProfile, CurvePoint } from '@roastpilot/shared';
import { soakLengthS } from './phase-plan';

/**
 * A step profile's planned curve, for the chart: charge and the turning point as written, each
 * step's end at its planned time, then the BT cap at the planned drop (docs/spec/roast-control.md).
 * A profile with no `target` steps keeps the curve it was given.
 */
export function plannedCurve(profile: AutoProfile): readonly CurvePoint[] {
  if (!profile.phases.some((phase) => phase.heat.mode === 'target')) return profile.curve;
  // Without a soak, the first step starts at charge.
  let atS = soakLengthS(profile);
  const steps = profile.phases.flatMap((phase) => {
    if (phase.heat.mode !== 'target') return [];
    atS += phase.heat.durationS;
    return [{ tS: atS, c: phase.heat.endC }];
  });
  const opening = profile.curve.filter((point) => point.tS < (steps[0]?.tS ?? 0)).slice(0, 2);
  return [...opening, ...steps, { tS: atS + profile.devTimeS, c: profile.capC }];
}
