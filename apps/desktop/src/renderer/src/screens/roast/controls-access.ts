import type { ControlsLevel, RoastPhase } from '@roastpilot/shared';

/** Guided: the heater only from Preheat until Drop. */
const GUIDED_HEATER: readonly RoastPhase[] = ['preheat', 'roasting', 'development'];
/** No roast running: everything but the heater, to cool or clean the roaster. */
const NO_ROAST: readonly RoastPhase[] = ['ready', 'done'];

export interface ControlsAccess {
  /** The heater slider takes input. */
  heater: boolean;
  /** The fan slider takes input. */
  fan: boolean;
  /** The cooling switch is on screen. */
  showCooling: boolean;
  /** The drum and filter fan switches take input. */
  switches: boolean;
}

/** Guided and Full control (docs/spec/manual-mode.md): how much of the screen is live. */
export function controlsAccess(
  level: ControlsLevel,
  phase: RoastPhase,
  connected: boolean,
): ControlsAccess {
  const full = level === 'full';
  const noRoast = NO_ROAST.includes(phase);
  return {
    heater: connected && (full || GUIDED_HEATER.includes(phase)),
    fan: connected && (full || noRoast || GUIDED_HEATER.includes(phase)),
    showCooling: full || noRoast,
    switches: connected,
  };
}
