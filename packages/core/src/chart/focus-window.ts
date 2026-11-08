/** A span of the chart's time axis, in seconds since charge. */
export interface TimeWindow {
  fromS: number;
  toS: number;
}

/** From Start the chart shows from 0:30 before charge (docs/spec/ui.md, Focus on the roast). */
export const FOCUS_BEFORE_CHARGE_S = 30;
/** The right edge stays this far past the expected end, and past now. */
export const FOCUS_AHEAD_S = 60;

/**
 * The roast's view from Start: −0:30 to the expected end + 1:00, its right edge moving out with the
 * clock to stay 1:00 ahead, never in jumps. Pass the previous window of the same roast: the edge
 * never comes back in, even when the expected end moves earlier (a ghost picked mid-roast).
 */
export function focusWindow(
  previous: TimeWindow | undefined,
  { nowS, expectedEndS }: { nowS: number; expectedEndS: number },
): TimeWindow {
  const toS = Math.max(
    expectedEndS + FOCUS_AHEAD_S,
    nowS + FOCUS_AHEAD_S,
    previous?.toS ?? -Infinity,
  );
  return { fromS: -FOCUS_BEFORE_CHARGE_S, toS };
}

/** History's view of a saved roast: −0:30 to its end + 0:30 (docs/spec/ui.md, History). */
export const HISTORY_AFTER_END_S = 30;

/**
 * A saved roast's focused view: −0:30 to its cool end (or End roast, or else drop) + 0:30.
 * Undefined when it has none of them: the whole recording is shown.
 */
export function savedRoastWindow({
  coolEndS,
  dropS,
}: {
  coolEndS: number | undefined;
  dropS: number | undefined;
}): TimeWindow | undefined {
  const endS = coolEndS ?? dropS;
  return endS === undefined
    ? undefined
    : { fromS: -FOCUS_BEFORE_CHARGE_S, toS: endS + HISTORY_AFTER_END_S };
}
