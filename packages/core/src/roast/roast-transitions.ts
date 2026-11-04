import { READY_ROAST, type RoastEvent, type RoastState } from '@roastpilot/shared';
import type { Charge } from './roast-detections';

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
  events: [{ kind: 'charge', atMs: charge.atMs, bt: charge.bt }],
});

export const cracked = (state: RoastState, event: RoastEvent): RoastState => ({
  ...state,
  phase: 'development',
  firstCrackAtMs: event.atMs,
  events: [...state.events, event],
});

export const dropped = (state: RoastState, event: RoastEvent, coolingMs: number): RoastState => ({
  ...state,
  phase: 'cooling',
  droppedAtMs: event.atMs,
  coolingEndsAtMs: event.atMs + coolingMs,
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
  events: [...state.events, event],
});

/** Clear: forgets the roast, keeps a running roaster cool-down. */
export const cleared = (state: RoastState): RoastState => ({
  ...READY_ROAST,
  roasterCoolingSinceMs: state.roasterCoolingSinceMs,
});

/** End in Preheat: nothing roasted; back to Ready with the preheat left on the chart. */
export const preheatEnded = (state: RoastState): RoastState => ({
  ...READY_ROAST,
  preheatAtMs: state.preheatAtMs,
});
