import type { RoastAction, RoastPhase } from '@roastpilot/shared';
import { ROAST_ON, type Outputs } from './roast-outputs';
import { DEFAULT_ROASTER_COOL_TO_C } from './roaster-cooldown';

/** Default bean cooling time; the Cool the beans for setting overrides it. */
export const DEFAULT_COOLING_MS = 4 * 60_000;
/** What +1 min adds to the cooling countdown. */
export const EXTEND_COOLING_MS = 60_000;

/** Which states each action may start from (docs/spec/manual-mode.md, Manual roast flow). */
export const ALLOWED_FROM: Readonly<Record<RoastAction, readonly RoastPhase[]>> = {
  preheat: ['ready', 'done'],
  // Full control may skip Preheat; the drum and filter fan still come on.
  start: ['ready', 'preheat'],
  'first-crack': ['roasting'],
  drop: ['roasting', 'development'],
  // Only with no roast running, so a roast in progress can't be wiped by accident.
  clear: ['ready', 'done'],
  // End roast / Finish cooling now: a normal stop, no heater lock (docs/spec/manual-mode.md).
  end: ['preheat', 'roasting', 'development', 'cooling'],
  'extend-cooling': ['cooling'],
  'cool-roaster': ['ready', 'done'],
  'stop-cooling-roaster': ['ready', 'done'],
};

/** What each phase keeps running, put back after a reconnect; never the heater above 0. */
export const PHASE_OUTPUTS: Readonly<Record<RoastPhase, Outputs>> = {
  ready: [],
  preheat: ROAST_ON,
  roasting: ROAST_ON,
  development: ROAST_ON,
  // Cooling's own outputs come from coolingOutputs (ManualRoast.restoreOutputs).
  cooling: ROAST_ON,
  done: [],
};

/** The roast settings ManualRoast follows, read at the moment they matter. */
export interface RoastOptions {
  findChargePoint: boolean;
  /** How long the beans cool. */
  coolingMs: number;
  /** Drum cooling from Drop. */
  coolRoasterAfter: boolean;
  /** Drum cooling's target. */
  roasterCoolToC: number;
  /** The tray fan sits under the drum and helps cool it (roasters.md). */
  coolerHelpsDrum: boolean;
}

export const DEFAULT_OPTIONS: RoastOptions = {
  findChargePoint: true,
  coolingMs: DEFAULT_COOLING_MS,
  coolRoasterAfter: true,
  roasterCoolToC: DEFAULT_ROASTER_COOL_TO_C,
  coolerHelpsDrum: false,
};
