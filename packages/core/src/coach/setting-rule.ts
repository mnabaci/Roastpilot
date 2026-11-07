import type { CoachChange } from '@roastpilot/shared';
import { curveTargetC } from '../auto/curve';
import { curveReason, phaseReason, STALLING, stepReason } from './coach-reason';
import type { CoachInput, CoachRule } from './coach-rule';

/** A suggestion only when Auto's setting is this many points or more from yours. */
export const SUGGEST_FROM_PCT = 10;

/** For this long after a phase begins, its name is the reason. */
export const PHASE_NEWS_S = 30;

function change(from: number | undefined, to: number): CoachChange | undefined {
  return from !== undefined && Math.abs(to - from) >= SUGGEST_FROM_PCT ? { from, to } : undefined;
}

/** Why, in one line (docs/spec/manual-mode.md, Coach). */
export function settingReason(input: CoachInput): string {
  const { step, btC } = input;
  if (step.stallTripped) return STALLING;
  const heat = step.phase?.heat;
  const named = phaseReason(step.phase?.name ?? 'Next phase', step.startC);
  if (!heat || heat.mode === 'fixed') return named;
  if (step.newForS !== undefined && step.newForS < PHASE_NEWS_S) return named;
  if (heat.mode === 'target') return stepReason(input.ror, heat.rorMin, heat.rorMax);
  const curveC = curveTargetC(input.profile.curve, input.elapsedS);
  return curveC === undefined || btC === undefined ? named : curveReason(btC - curveC, input.trend);
}

/**
 * Auto's heater and fan, when either is 10 points or more from what you set. Never in the soak:
 * it is Auto's own way to start, and a manual roast usually charges with the heat on.
 */
export const autoSettingRule: CoachRule = {
  id: 'auto-setting',
  advise: (input) => {
    if (input.step.soak) return undefined;
    const heater = change(input.set.heater, input.wants.heater);
    const fan = change(input.set.fan, input.wants.fan);
    if (!heater && !fan) return undefined;
    return {
      kind: 'setting',
      ...(heater ? { heater } : {}),
      ...(fan ? { fan } : {}),
      reason: settingReason(input),
    };
  },
};
