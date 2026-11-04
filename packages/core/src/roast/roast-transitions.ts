import { READY_ROAST, type RoastEvent, type RoastState } from '@roastpilot/shared';
import type { Charge } from './roast-detections';
import { BEAN_COOL_MAX_MS, type RoastOptions } from './roast-rules';

/**
 * The roast's state after each step (docs/spec/manual-mode.md), as plain functions: ManualRoast
 * decides when, these say what changes.
 */
export const preheated = (nowMs: number): RoastState => ({
  ...READY_ROAST,
  phase: 'preheat',
  preheatAtMs: nowMs,
});

/** Beans in: the clock starts at the charge point, which may be before the press. */
export const started = (state: RoastState, charge: Charge, pressedAtMs: number): RoastState => ({
  ...state,
  phase: 'roasting',
  chargedAtMs: charge.atMs,
  startPressedAtMs: pressedAtMs,
  roasterCoolingSinceMs: null,
  roasterCoolToC: null,
  events: [{ kind: 'charge', atMs: charge.atMs, bt: charge.bt }],
});

export const cracked = (state: RoastState, event: RoastEvent): RoastState => ({
  ...state,
  phase: 'development',
  firstCrackAtMs: event.atMs,
  events: [...state.events, event],
});

/**
 * Beans out: cooling ends after `coolingMs`, or once BT is below `belowC` (capped at
 * BEAN_COOL_MAX_MS). Taken now, so a settings change mid-cooling doesn't move it.
 */
export const dropped = (
  state: RoastState,
  event: RoastEvent,
  { coolingMs, coolingBelowC }: Pick<RoastOptions, 'coolingMs' | 'coolingBelowC'>,
): RoastState => ({
  ...state,
  phase: 'cooling',
  droppedAtMs: event.atMs,
  coolingEndsAtMs: event.atMs + (coolingBelowC === null ? coolingMs : BEAN_COOL_MAX_MS),
  coolingBelowC,
  events: [...state.events, event],
});

/** Ended between Charge and Drop: done where it is. */
export const ended = (state: RoastState, event: RoastEvent): RoastState => ({
  ...state,
  phase: 'done',
  events: [...state.events, event],
});

/** Bean cooling is over. */
export const cooled = (state: RoastState, event: RoastEvent): RoastState => ({
  ...state,
  phase: 'done',
  coolingEndsAtMs: null,
  coolingBelowC: null,
  events: [...state.events, event],
});

/** Clear: forgets the roast, keeps a running roaster cool-down. */
export const cleared = (state: RoastState): RoastState => ({
  ...READY_ROAST,
  roasterCoolingSinceMs: state.roasterCoolingSinceMs,
  roasterCoolToC: state.roasterCoolToC,
});

/** End in Preheat: nothing roasted; back to Ready with the preheat left on the chart. */
export const preheatEnded = (state: RoastState): RoastState => ({
  ...READY_ROAST,
  preheatAtMs: state.preheatAtMs,
});
