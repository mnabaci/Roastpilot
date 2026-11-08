import { PROFILE_SCHEMA_VERSION, type AutoProfile, type AutoTuning } from '@roastpilot/shared';
import type { CoachInput } from './coach-rule';

/** A soak, a step, then a curve phase, as the coach's tests roast it. */
export const COACH_PROFILE: AutoProfile = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  id: 'light-steps',
  name: 'Light · Steps',
  needsCalibration: false,
  batchG: 385,
  chargeC: 180,
  dryEndC: 150,
  devTimeS: 90,
  capC: 220,
  curve: [
    { tS: 0, c: 180 },
    { tS: 60, c: 95 },
    { tS: 300, c: 150 },
    { tS: 600, c: 200 },
  ],
  phases: [
    { name: 'Soak', heat: { mode: 'fixed', pct: 0 }, fanPct: 30, next: { on: 'time', afterS: 60 } },
    {
      name: 'Drying',
      heat: { mode: 'target', pct: 80, endC: 150, durationS: 240, rorMin: 8, rorMax: 12 },
      fanPct: 30,
      next: { on: 'bt', c: 150, backupS: 400 },
    },
    { name: 'Maillard', heat: { mode: 'follow', pct: 60 }, fanPct: 50, next: { on: 'end' } },
  ],
};

export const COACH_TUNING: AutoTuning = {
  target: { kp: 1, ki: 0, kd: 0 },
  targetLimitPct: 20,
  curveFollow: {
    gains: { kp: 1, ki: 0, kd: 0 },
    limitPct: 20,
    lookAheadS: 30,
    pullPerC: 0.3,
    slewPctPer10s: 5,
  },
  preheat: { kp: 1, ki: 0, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  chargeCutS: 5,
};

/** A reading in Roasting, at Auto's Drying step, with heater and fan where Auto wants them. */
export function coachInputOf(change: Partial<CoachInput> = {}): CoachInput {
  return {
    roastPhase: 'roasting',
    nowMs: 200_000,
    elapsedS: 200,
    btC: 140,
    ror: 10,
    trend: 'steady',
    firstCrackAtMs: null,
    profile: COACH_PROFILE,
    step: {
      index: 1,
      phase: COACH_PROFILE.phases[1],
      soak: false,
      startC: 95,
      newForS: 140,
      stallTripped: false,
    },
    set: { heater: 80, fan: 30 },
    wants: { heater: 80, fan: 30 },
    expectedFirstCrackC: 196,
    ...change,
  };
}
