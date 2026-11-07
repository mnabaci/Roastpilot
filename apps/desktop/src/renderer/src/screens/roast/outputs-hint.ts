import type { ControlsAccess } from './controls-access';
import type { RoastPhase } from '@roastpilot/shared';

/** What the outputs panel needs to say why a control is as it is. */
export interface OutputsHintInput {
  locked: boolean;
  connected: boolean;
  /** Auto drives this roast, and has stopped. */
  autoStopped: boolean;
  phase: RoastPhase;
  access: Pick<ControlsAccess, 'heater'>;
  heaterPct: number;
  drumPct: number;
}

/** One line under the outputs, the most pressing first; undefined when all is as expected. */
export function outputsHint(input: OutputsHintInput): string | undefined {
  const { locked, connected, autoStopped, phase, access, heaterPct, drumPct } = input;
  if (locked) return 'Heater locked · acknowledge above';
  if (autoStopped) return 'Auto stopped · heater and fan are yours';
  // Only from live readings: while the connection is lost the values are the last known ones.
  if (!connected) return undefined;
  if (heaterPct > 0 && drumPct === 0) return 'Drum is off';
  if (access.heater) return undefined;
  return phase === 'cooling'
    ? 'Cooling beans · heater off, fan at 100%'
    : 'Heater waits for Preheat';
}
