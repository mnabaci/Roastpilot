import type { ConnectionState, RoastAction, RoastPhase } from '@roastpilot/shared';

export interface FlowButton {
  action: RoastAction;
  label: string;
}

/** A normal stop, asked once inline (docs/spec/manual-mode.md, End roast). */
export interface FlowStop {
  label: string;
  question: string;
}

/** The one obvious next action for a state, an optional second one, a stop, and a one-line hint. */
export interface FlowStep {
  primary?: FlowButton;
  secondary?: FlowButton;
  stop?: FlowStop;
  hint: string;
}

const END_ROAST: FlowStop = {
  label: 'End roast',
  question: 'End the roast? · everything turns off',
};

/** The Guided flow from docs/spec/manual-mode.md: Connect → Preheat → Start → First crack → Drop. */
const STEPS: Readonly<Record<RoastPhase, FlowStep>> = {
  ready: {
    primary: { action: 'preheat', label: 'Preheat' },
    hint: 'Drum and filter on · set the heater to warm up, then add beans.',
  },
  preheat: {
    primary: { action: 'start', label: 'Beans in · Start' },
    stop: END_ROAST,
    hint: 'Press as the beans go in.',
  },
  roasting: {
    primary: { action: 'first-crack', label: 'First crack' },
    secondary: { action: 'drop', label: 'Drop now' },
    stop: END_ROAST,
    hint: 'Press when you hear the first crack.',
  },
  development: {
    primary: { action: 'drop', label: 'Drop now' },
    stop: END_ROAST,
    hint: 'Drop when the colour is right.',
  },
  cooling: {
    stop: { label: 'Finish cooling now', question: 'Finish cooling? · everything turns off' },
    hint: 'Dump the beans into the cooling tray.',
  },
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
