import type { ControlsLevel, RoastPhase } from '@roastpilot/shared';

const GUIDED_LIVE: readonly RoastPhase[] = ['preheat', 'roasting', 'development'];

export interface ControlsAccess {
  /** Heater and fan sliders take input. */
  outputs: boolean;
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
  return {
    outputs: connected && (full || GUIDED_LIVE.includes(phase)),
    showCooling: full,
    switches: connected,
  };
}
