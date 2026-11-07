/** Heads-ups count down in steps of this many seconds, so the line doesn't change every reading. */
export const ETA_STEP_S = 5;

/**
 * Seconds until BT reaches `targetC` at the current RoR (°C/min). Undefined without a reading, a
 * target or a rise, or once BT is there.
 */
export function secondsTo(
  targetC: number | undefined,
  btC: number | undefined,
  ror: number | undefined,
): number | undefined {
  if (targetC === undefined || btC === undefined || ror === undefined) return undefined;
  if (!(ror > 0) || btC >= targetC) return undefined;
  return ((targetC - btC) / ror) * 60;
}

/** "~45 s": rounded to the step, and never below one step while the moment is still to come. */
export function roundEta(seconds: number): number {
  return Math.max(ETA_STEP_S, Math.round(seconds / ETA_STEP_S) * ETA_STEP_S);
}
