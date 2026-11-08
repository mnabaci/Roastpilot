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
 * The floor for this moment: when a drawn line in view goes below it, straight down to the
 * multiple of 25 °C at or below that line in one go, so nothing is clipped even for a reading;
 * never up, never below 0.
 */
export function nextFloorC(floorC: number, lowestDrawnC: number | undefined): number {
  if (lowestDrawnC === undefined || lowestDrawnC >= floorC) return floorC;
  return Math.max(0, Math.floor(lowestDrawnC / FLOOR_STEP_C) * FLOOR_STEP_C);
}
