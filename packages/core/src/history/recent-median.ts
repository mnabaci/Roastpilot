/** How many recent roasts with the value set what to expect. */
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

/** What the median reads of a saved roast besides the value. */
export interface RecentRoast {
  roasterId: number | null;
  startedAt: string;
}

/**
 * The median of `value` over the last 5 saved roasts that have it, from this roaster when it has
 * any, otherwise from all; undefined without any.
 */
export function recentMedian<R extends RecentRoast>(
  roasts: readonly R[],
  roasterId: number | undefined,
  value: (roast: R) => number | null | undefined,
): number | undefined {
  const withValue = roasts.flatMap((r) => {
    const v = value(r);
    return v === null || v === undefined ? [] : [{ roast: r, v }];
  });
  const own = withValue.filter(({ roast }) => roast.roasterId === roasterId);
  const newestFirst = [...(own.length > 0 ? own : withValue)].sort((a, b) =>
    b.roast.startedAt.localeCompare(a.roast.startedAt),
  );
  return median(newestFirst.slice(0, RECENT).map(({ v }) => v));
}
