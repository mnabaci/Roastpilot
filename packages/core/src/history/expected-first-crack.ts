import type { RoastSummary } from '@roastpilot/shared';
import { recentMedian } from './recent-median';

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
  return recentMedian(roasts, roasterId, (r) => r.fcTemp);
}
