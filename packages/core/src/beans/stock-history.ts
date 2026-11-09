import type { StockMovement } from '@roastpilot/shared';

/** A movement with the green stock it left. */
export interface StockStep extends StockMovement {
  greenAfterG: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The green stock after each movement (docs/spec/batch-and-stock.md, Stock history), worked back
 * from today's: right now even when older records are missing (a deleted roast, stock from before
 * adjustments were kept). It never shows below 0, as stock stops there.
 */
export function stockTimeline(movements: readonly StockMovement[], greenNowG: number): StockStep[] {
  const steps: StockStep[] = [];
  let after = greenNowG;
  for (let i = movements.length - 1; i >= 0; i -= 1) {
    const movement = movements[i];
    if (!movement) continue;
    steps.push({ ...movement, greenAfterG: Math.max(0, after) });
    after -= movement.greenG;
  }
  return steps.reverse();
}

export interface StockSummary {
  /** How many purchases, and their grams. */
  timesBought: number;
  boughtG: number;
  /** Roasts made here, and the green they took. */
  roasts: number;
  usedG: number;
  /** Green roasted a week, from the first roast to now; null before two weeks of roasting. */
  weeklyUseG: number | null;
  /** How long the green stock lasts at that pace; null without a pace. */
  weeksLeft: number | null;
  /** The last purchase's date. */
  lastBoughtAt: string | null;
}

/**
 * What the history adds up to. The weekly pace needs two weeks of roasting, so one busy weekend
 * doesn't read as a habit.
 */
export function stockSummary(
  movements: readonly StockMovement[],
  greenNowG: number,
  nowMs: number,
): StockSummary {
  const bought = movements.filter((m) => m.kind === 'bought');
  const roasted = movements.filter((m) => m.kind === 'roasted');
  const usedG = roasted.reduce((sum, m) => sum - m.greenG, 0);
  const firstRoastMs = roasted[0] ? Date.parse(roasted[0].at) : Number.NaN;
  const weeks = (nowMs - firstRoastMs) / WEEK_MS;
  const weeklyUseG = Number.isFinite(weeks) && weeks >= 2 && usedG > 0 ? usedG / weeks : null;
  return {
    timesBought: bought.length,
    boughtG: bought.reduce((sum, m) => sum + m.greenG, 0),
    roasts: roasted.length,
    usedG,
    weeklyUseG,
    weeksLeft: weeklyUseG === null ? null : greenNowG / weeklyUseG,
    lastBoughtAt: bought.at(-1)?.at ?? null,
  };
}
