import type { SafetyRule } from '../safety-rule';
import { frozenReadingRule } from './frozen-reading';
import { lostConnectionRule } from './lost-connection';
import { maxRoastTimeRule } from './max-roast-time';
import { maxTemperatureRule } from './max-temperature';
import { slowRiseRule } from './slow-rise';

export const SAFETY_RULES: readonly SafetyRule[] = [
  maxTemperatureRule,
  lostConnectionRule,
  maxRoastTimeRule,
  slowRiseRule,
  frozenReadingRule,
];
