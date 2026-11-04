import type { ConnectionState, RoastAction, RoastPhase } from '@roastpilot/shared';

export interface FlowButton {
  action: RoastAction;
  label: string;
  /** A way back rather than forward (Cancel preheat): drawn as a quiet ghost button. */
  quiet?: boolean;
}

/** The one obvious next action for a state, an optional second one, and a one-line hint. */
export interface FlowStep {
  primary?: FlowButton;
  secondary?: FlowButton;
  hint: string;
}

/** The Guided flow from docs/spec/manual-mode.md: Connect → Preheat → Start → First crack → Drop. */
const STEPS: Readonly<Record<RoastPhase, FlowStep>> = {
  ready: {
    primary: { action: 'preheat', label: 'Preheat' },
    hint: 'Drum and filter on · set the heater to warm up, then add beans.',
  },
  preheat: {
    primary: { action: 'start', label: 'Beans in · Start' },
    secondary: { action: 'cancel-preheat', label: 'Cancel preheat', quiet: true },
    hint: 'Press as the beans go in.',
  },
  roasting: {
    primary: { action: 'first-crack', label: 'First crack' },
    secondary: { action: 'drop', label: 'Drop now' },
    hint: 'Press when you hear the first crack.',
  },
  development: {
    primary: { action: 'drop', label: 'Drop now' },
    hint: 'Drop when the colour is right.',
  },
  cooling: { hint: 'Dump the beans into the cooling tray.' },
  done: {
    primary: { action: 'preheat', label: 'Preheat' },
    hint: 'Done. Preheat for the next batch.',
  },
};

export function flowStep(phase: RoastPhase): FlowStep {
  return STEPS[phase];
}

export const isConnected = (connection: ConnectionState): boolean =>
  connection.status === 'connected';
