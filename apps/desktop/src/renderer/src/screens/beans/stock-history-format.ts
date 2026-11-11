import type { StockStep, StockSummary } from '@roastpilot/core';
import type { StockKind, StockMovement } from '@roastpilot/shared';
import { formatGrams } from './batch-format';

/** Every stock log kind's label, the one place a new kind adds one. */
const KIND: Record<StockKind, string> = {
  bought: 'Bought',
  roasted: 'Roasted',
  counted: 'Counted',
  returned: 'Returned at Clear',
  taken: 'Taken out',
};

/** A purchase's day is local midnight, not UTC's, so it never shows as the day before. */
export const stockMs = (at: string): number =>
  Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T00:00` : at);

/** "4 Nov", with the year when it isn't this one: "4 Nov 2025". */
export function stockDay(at: string, nowMs: number, timeZone?: string): string {
  const date = new Date(stockMs(at));
  const sameYear =
    date.toLocaleDateString('en-GB', { year: 'numeric', timeZone }) ===
    new Date(nowMs).toLocaleDateString('en-GB', { year: 'numeric', timeZone });
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  });
}

/** "+2,000 g" or "−400 g", with a real minus; 0 g has no sign. */
export function signedGrams(g: number): string {
  const rounded = Math.round(g);
  if (rounded === 0) return formatGrams(0);
  return `${rounded > 0 ? '+' : '−'}${formatGrams(Math.abs(rounded))}`;
}

/** What a roasted row says once its roast is deleted: its grams stay in the history. */
const ROAST_DELETED = 'roast deleted';

/**
 * What moved the stock: "Roasted", "Roasted · roast deleted", or "Taken out · Gave 200 g to Sam"
 * with its note.
 */
export function stockKind(step: Pick<StockMovement, 'kind' | 'note' | 'roastId'>): string {
  const detail = step.kind === 'roasted' && step.roastId === null ? ROAST_DELETED : step.note;
  return detail ? `${KIND[step.kind]} · ${detail}` : KIND[step.kind];
}

/** "Roasted · −400 g", for the chart's tooltip. */
export const stockWhat = (step: StockStep): string =>
  `${stockKind(step)} · ${signedGrams(step.greenG)}`;

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${String(n)} times`);

/** The folded card's line: "Bought twice · 360 g a week", or what there is of it. */
export function stockLine(summary: StockSummary): string {
  const parts = [
    summary.timesBought > 0 ? `Bought ${times(summary.timesBought)}` : null,
    summary.weeklyUseG === null
      ? summary.roasts > 0
        ? `${String(summary.roasts)} ${summary.roasts === 1 ? 'roast' : 'roasts'}`
        : null
      : `${formatGrams(summary.weeklyUseG)} a week`,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing yet';
}

/** "About 3 weeks", "Under a week", or "About 4 months" past 12 weeks. */
export function lasts(weeksLeft: number): string {
  if (weeksLeft < 1) return 'Under a week';
  if (weeksLeft < 1.5) return 'About a week';
  if (weeksLeft > 12) return `About ${String(Math.round(weeksLeft / 4.35))} months`;
  return `About ${String(Math.round(weeksLeft))} weeks`;
}

export { times as boughtTimes };
