import type { RoastSummary } from '@roastpilot/shared';
import { recentMedian } from './recent-median';

/** What the expected turning point reads of a saved roast. */
export type TurningPointRoast = Pick<RoastSummary, 'tpTemp' | 'roasterId' | 'startedAt'>;

/**
 * BT at the turning point the saved roasts suggest (docs/spec/ui.md, Temperature focus): the
 * median of the last 5 that had one, this roaster's when it has any, like the expected first crack.
 */
export function savedTurningPointC(
  roasts: readonly TurningPointRoast[],
  roasterId: number | undefined,
): number | undefined {
  return recentMedian(roasts, roasterId, (r) => r.tpTemp);
}
