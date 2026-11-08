/** The fitted floor moves in steps of this many °C (docs/spec/ui.md, Temperature focus). */
export const FLOOR_STEP_C = 25;
/** Room below the expected turning point, so the dip after charge stays in view. */
export const FLOOR_BELOW_TP_C = 15;
/** The floor when there is no turning point to expect. */
export const DEFAULT_FLOOR_C = 50;

/**
 * The turning point to expect at Start: the ghost's, else the plan's, else the saved roasts'
 * (`savedTurningPointC`); undefined with none of them.
 */
export function expectedTurningPointC({
  ghostC,
  planC,
  savedC,
}: {
  ghostC: number | undefined;
  planC: number | undefined;
  savedC: number | undefined;
}): number | undefined {
  return ghostC ?? planC ?? savedC;
}

/**
 * The temperature axis floor set at Start: expected TP − 15 °C rounded down to a multiple of 25,
 * at least 0 (TP 88 → 50, TP 95 → 75); 50 °C with no TP to expect.
 */
export function startFloorC(expectedTpC: number | undefined): number {
  if (expectedTpC === undefined) return DEFAULT_FLOOR_C;
  return Math.max(0, Math.floor((expectedTpC - FLOOR_BELOW_TP_C) / FLOOR_STEP_C) * FLOOR_STEP_C);
}

/**
 * The floor for this moment: one 25 °C step down from the last one when a drawn line in view goes
 * below it, so it settles smoothly over a few redraws; never up, never below 0.
 */
export function nextFloorC(floorC: number, lowestDrawnC: number | undefined): number {
  return lowestDrawnC !== undefined && lowestDrawnC < floorC
    ? Math.max(0, floorC - FLOOR_STEP_C)
    : floorC;
}
