import { toUnit, type TemperatureUnit } from '@roastpilot/shared';

/** The fitted floor moves in steps of this many °C (docs/spec/ui.md, Temperature focus). */
export const FLOOR_STEP_C = 25;
/** In °F it moves in steps of 50 °F, so the axis starts on a round °F number. */
export const FLOOR_STEP_F = 50;
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

/** Float dust: 37.8 °C is 100.00000000000001 °F, or 99.99999999999999, and must stay 100 °F. */
const DUST = 1e-6;

/**
 * The step at or below `c` in the unit shown, at least 0 in that unit, in °C: a multiple of
 * 25 °C, or of 50 °F (docs/spec/ui.md, Units).
 */
function stepDownC(c: number, unit: TemperatureUnit): number {
  if (unit === 'c') return Math.max(0, Math.floor(c / FLOOR_STEP_C) * FLOOR_STEP_C);
  const stepF = Math.max(0, Math.floor(toUnit(c, unit) / FLOOR_STEP_F + DUST) * FLOOR_STEP_F);
  // Exact, not fromUnit's 0.1: the chart shows this floor as the round °F number again.
  return (stepF - 32) / 1.8;
}

/**
 * The temperature axis floor set at Start: expected TP − 15 °C rounded down to a multiple of 25,
 * at least 0 (TP 88 → 50, TP 95 → 75); 50 °C with no TP to expect. In °F, a multiple of 50 °F.
 */
export function startFloorC(expectedTpC: number | undefined, unit: TemperatureUnit = 'c'): number {
  return stepDownC(
    expectedTpC === undefined ? DEFAULT_FLOOR_C : expectedTpC - FLOOR_BELOW_TP_C,
    unit,
  );
}

/**
 * The floor for this moment: when a drawn line in view goes below it, straight down to the
 * multiple of 25 °C (50 °F) at or below that line in one go, so nothing is clipped even for a
 * reading; never up, never below 0. A floor off the unit's steps (the unit just changed) moves
 * down onto them.
 */
export function nextFloorC(
  floorC: number,
  lowestDrawnC: number | undefined,
  unit: TemperatureUnit = 'c',
): number {
  const onStep = stepDownC(floorC, unit);
  if (lowestDrawnC === undefined || lowestDrawnC >= onStep) return onStep;
  return stepDownC(lowestDrawnC, unit);
}
