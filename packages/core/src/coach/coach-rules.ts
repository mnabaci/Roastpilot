import type { CoachRule } from './coach-rule';
import { dropSoonRule } from './drop-soon-rule';
import { firstCrackSoonRule } from './first-crack-soon-rule';
import { autoSettingRule } from './setting-rule';

/** The coach's tips in order: Auto's setting first, then the heads-ups (ADR 0019). */
export const COACH_RULES: readonly CoachRule[] = [
  autoSettingRule,
  firstCrackSoonRule,
  dropSoonRule,
];
