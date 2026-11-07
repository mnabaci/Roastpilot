/** Drum cooling (docs/spec/manual-mode.md): runs until the empty drum is below its target. */
export const DEFAULT_ROASTER_COOL_TO_C = 50;
/** Cool the drum is offered in Ready and Done from this far above the target. */
export const ROASTER_COOL_OFFER_ABOVE_C = 10;
/** Gives up this long after Cool the drum, so a stuck probe can't keep the fan running for ever. */
export const ROASTER_COOL_MAX_MS = 15 * 60_000;
/** From Drop: the beans' few minutes plus about the same 15. */
export const ROASTER_COOL_AFTER_DROP_MAX_MS = 20 * 60_000;

export type RoasterCooldownCheck = 'running' | 'cooled' | 'gave-up';

/** Whether drum cooling to `toC` that began at `sinceMs` is still needed, given the latest BT. */
export function roasterCooldownCheck(
  sinceMs: number,
  nowMs: number,
  bt: number | undefined,
  toC: number,
  maxMs: number,
): RoasterCooldownCheck {
  if (nowMs - sinceMs >= maxMs) return 'gave-up';
  return bt !== undefined && bt < toC ? 'cooled' : 'running';
}
