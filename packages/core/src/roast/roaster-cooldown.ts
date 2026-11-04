/** Roaster cool-down (docs/spec/manual-mode.md): runs until the empty drum is below this. */
export const ROASTER_COOL_C = 50;
/** Cool down roaster is offered in Ready and Done from this temperature. */
export const ROASTER_COOL_OFFER_C = 60;
/** Gives up after this long, so a stuck probe can't keep the fan running for ever. */
export const ROASTER_COOL_MAX_MS = 15 * 60_000;

export type RoasterCooldownCheck = 'running' | 'cooled' | 'gave-up';

/** Whether a cool-down that began at `sinceMs` is still needed, given the latest BT. */
export function roasterCooldownCheck(
  sinceMs: number,
  nowMs: number,
  bt: number | undefined,
): RoasterCooldownCheck {
  if (nowMs - sinceMs >= ROASTER_COOL_MAX_MS) return 'gave-up';
  return bt !== undefined && bt < ROASTER_COOL_C ? 'cooled' : 'running';
}
