import type { RoastSummary } from '@roastpilot/shared';

/** How many recent roasts with a first crack set the expected temperature. */
const RECENT = 5;

/** The middle value, or the mean of the two middle ones; undefined for none. */
function median(values: readonly number[]): number | undefined {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  const lower = sorted[mid - 1];
  if (upper === undefined) return undefined;
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}

/** What the expected first crack reads of a saved roast. */
export type FirstCrackRoast = Pick<RoastSummary, 'fcTemp' | 'roasterId' | 'startedAt'>;

/**
 * BT at first crack to expect (docs/spec/ui.md, Sounds): the median of the last 5 saved roasts that
 * had one, from this roaster when it has any, otherwise from all. Undefined without any.
 */
export function expectedFirstCrackC(
  roasts: readonly FirstCrackRoast[],
  roasterId: number | undefined,
): number | undefined {
  const cracked = roasts.filter((r) => r.fcTemp !== null);
  const own = cracked.filter((r) => r.roasterId === roasterId);
  const newestFirst = [...(own.length > 0 ? own : cracked)].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  return median(newestFirst.slice(0, RECENT).flatMap((r) => (r.fcTemp === null ? [] : [r.fcTemp])));
}
