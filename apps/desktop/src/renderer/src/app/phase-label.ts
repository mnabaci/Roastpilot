import type { RoastPhase } from '@roastpilot/shared';

/** How each phase is named on screen. */
export const PHASE_LABEL: Readonly<Record<RoastPhase, string>> = {
  ready: 'Ready',
  preheat: 'Preheat',
  roasting: 'Roasting',
  development: 'Development',
  cooling: 'Cooling beans',
  done: 'Done',
};
