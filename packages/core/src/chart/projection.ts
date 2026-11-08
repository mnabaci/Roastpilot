/** A point the chart draws: seconds since charge and °C. */
export interface ProjectedPoint {
  tS: number;
  c: number;
}

/** How far ahead the projection reaches (docs/spec/ui.md, During a roast). */
export const PROJECTION_AHEAD_S = 120;

/**
 * Where the temperature is heading at the current RoR: a straight line from the latest point, 2:00
 * ahead or to the chart's edge if nearer. None while RoR is unknown or at or below 0, since a
 * falling or flat line (the dip after charge) says nothing about where the roast goes.
 */
export function projection({
  nowS,
  btC,
  rorCPerMin,
  edgeS,
}: {
  nowS: number;
  btC: number | undefined;
  rorCPerMin: number | undefined;
  edgeS: number;
}): readonly ProjectedPoint[] {
  if (btC === undefined || rorCPerMin === undefined || rorCPerMin <= 0) return [];
  const endS = Math.min(nowS + PROJECTION_AHEAD_S, edgeS);
  if (endS <= nowS) return [];
  return [
    { tS: nowS, c: btC },
    { tS: endS, c: btC + (rorCPerMin * (endS - nowS)) / 60 },
  ];
}
