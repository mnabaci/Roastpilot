import type { AutoProfile } from '@roastpilot/shared';
import { plannedCurve } from '../auto/steps-curve';

/** With neither a profile nor a ghost, a roast is expected to end at 12:00 (docs/spec/ui.md, Chart). */
export const DEFAULT_ROAST_END_S = 720;

/** When a profile plans to drop, in seconds since charge: the end of its planned curve. */
export function plannedDropS(profile: AutoProfile): number | undefined {
  return plannedCurve(profile).at(-1)?.tS;
}

/** The lowest point of a profile's planned curve: its turning point, °C. */
export function plannedTurningPointC(profile: AutoProfile): number | undefined {
  const curve = plannedCurve(profile);
  return curve.length === 0 ? undefined : Math.min(...curve.map((p) => p.c));
}

/**
 * When this roast is expected to end, in seconds since charge: the planned drop of the profile in
 * use, else the ghost's drop, else 12:00 (docs/spec/ui.md, Focus on the roast).
 */
export function expectedRoastEndS({
  plannedDropS: planned,
  ghostDropS,
}: {
  plannedDropS: number | undefined;
  ghostDropS: number | undefined;
}): number {
  return planned ?? ghostDropS ?? DEFAULT_ROAST_END_S;
}
