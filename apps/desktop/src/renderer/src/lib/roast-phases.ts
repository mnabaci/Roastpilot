import type { RoastPhase } from '@roastpilot/shared';

/** The phases Auto drives, Preheat until Drop; cooling it leaves alone (docs/spec/roast-control.md). */
const AUTO_DRIVEN: readonly RoastPhase[] = ['preheat', 'roasting', 'development'];

export const isAutoDriven = (phase: RoastPhase): boolean => AUTO_DRIVEN.includes(phase);
