import type { ConnectionState, RoastAction, RoastPhase, RoastState } from '@roastpilot/shared';
import { formatClock } from '@roastpilot/ui';

export interface FlowButton {
  action: RoastAction;
  label: string;
}

/** A normal stop, asked once inline (docs/spec/manual-mode.md, Stop roast). */
export interface FlowStop {
  label: string;
  question: string;
}

/**
 * The one obvious next action for a state, an optional second one, a quiet one, a stop, and a
 * one-line hint.
 */
export interface FlowStep {
  /** Auto's Charge soon takes the primary place (docs/spec/roast-control.md). */
  chargeSoon?: boolean;
  primary?: FlowButton;
  secondary?: FlowButton;
  quiet?: FlowButton;
  stop?: FlowStop;
  hint: string;
}

/** The normal stop before cooling; its words follow the phase (`stopCopy`). */
export const END_ROAST: FlowStop = {
  label: 'Stop roast',
  question: 'Stop the roast?',
};

/**
 * The normal stop's words by phase (docs/spec/manual-mode.md, Stop): "Stop preheat" while
 * preheating (nothing is saved), else "Stop roast" (the roast is saved as stopped).
 */
export function stopCopy(phase: RoastPhase): {
  label: string;
  question: string;
  keep: string;
  consequences: readonly string[];
} {
  const off = 'Heater, fan, drum and filter off now';
  return phase === 'preheat'
    ? {
        label: 'Stop preheat',
        question: 'Stop the preheat?',
        keep: 'Keep preheating',
        consequences: [off, 'Back to Ready · nothing is saved'],
      }
    : {
        label: END_ROAST.label,
        question: END_ROAST.question,
        keep: 'Keep roasting',
        consequences: [
          off,
          'No bean cooling · dump the beans yourself',
          'The roast is saved as stopped',
        ],
      };
}

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
    quiet: { action: 'extend-cooling', label: '+1 min' },
    stop: {
      label: 'Finish cooling now',
      question: 'Finish cooling the beans? · the countdown ends now',
    },
    hint: 'Dump the beans into the cooling tray.',
  },
  done: {
    primary: { action: 'preheat', label: 'Preheat' },
    hint: 'Done. Preheat for the next batch.',
  },
};

/** The step for this roast. */
export function flowStep(roast: RoastState): FlowStep {
  return STEPS[roast.phase];
}

/** A charge point found at least this much before the press is worth saying. */
const CHARGE_NOTE_MS = 1000;

/**
 * The one-line hint under the primary action: while cooling, the beans' countdown; while roasting,
 * how much earlier the charge point was found than the press (docs/spec/manual-mode.md).
 */
export function flowHint(
  roast: RoastState,
  { coolingLeftS }: { coolingLeftS: number | undefined },
): string {
  const { hint } = STEPS[roast.phase];
  if (roast.phase === 'cooling' && coolingLeftS !== undefined)
    return `${hint} ${formatClock(coolingLeftS)} left.`;
  const { chargedAtMs, startPressedAtMs } = roast;
  if (roast.phase === 'roasting' && chargedAtMs !== null && startPressedAtMs !== null) {
    const earlierMs = startPressedAtMs - chargedAtMs;
    if (earlierMs >= CHARGE_NOTE_MS)
      return `Charge found ${formatClock(earlierMs / 1000)} before you pressed · press at first crack.`;
  }
  return hint;
}

export const isConnected = (connection: ConnectionState): boolean =>
  connection.status === 'connected';
