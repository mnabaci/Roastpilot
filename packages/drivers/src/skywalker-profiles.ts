import {
  AutoProfileSchema,
  AutoTuningSchema,
  CURVE_FOLLOW_DEFAULTS,
  PROFILE_SCHEMA_VERSION,
  type AutoProfile,
  type AutoTuning,
  type CurvePoint,
  type PhaseHeat,
  type PhaseNext,
  type ProfileId,
  type ProfilePhase,
} from '@roastpilot/shared';

/** Roast 7 of 2026-11-04 (docs/spec/roast-control.md, Built-in Skywalker profiles). */
const LIGHT_CURVE: readonly CurvePoint[] = [
  { tS: 0, c: 180 },
  { tS: 64, c: 92 },
  { tS: 154, c: 110 },
  { tS: 305, c: 150 },
  { tS: 379, c: 165 },
  { tS: 477, c: 180 },
  { tS: 558, c: 190 },
  { tS: 663, c: 197 },
];

interface PlannedStep {
  name: string;
  endC: number;
  durationS: number;
  heatPct: number;
  rorMin: number;
  rorMax: number;
  fanPct: number;
  next: PhaseNext;
}

const LIGHT_STEPS: readonly PlannedStep[] = [
  {
    name: 'Heat on',
    endC: 150,
    durationS: 245,
    heatPct: 85,
    rorMin: 14,
    rorMax: 18,
    fanPct: 30,
    next: { on: 'bt', c: 150, backupS: 390 },
  },
  {
    name: 'Yellowing',
    endC: 165,
    durationS: 74,
    heatPct: 65,
    rorMin: 12,
    rorMax: 14,
    fanPct: 50,
    next: { on: 'bt', c: 165, backupS: 480 },
  },
  {
    name: 'Maillard',
    endC: 180,
    durationS: 98,
    heatPct: 50,
    rorMin: 8,
    rorMax: 10,
    fanPct: 65,
    next: { on: 'bt', c: 180, backupS: 660 },
  },
  {
    name: 'Development',
    endC: 191,
    durationS: 94,
    heatPct: 40,
    rorMin: 3,
    rorMax: 7,
    fanPct: 80,
    next: { on: 'end' },
  },
];

const SOAK: ProfilePhase = {
  name: 'Soak',
  heat: { mode: 'fixed', pct: 0 },
  fanPct: 30,
  next: { on: 'time', afterS: 60 },
};

function lightProfile(
  id: ProfileId,
  name: string,
  heatFor: (step: PlannedStep) => PhaseHeat,
): AutoProfile {
  return AutoProfileSchema.parse({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    id,
    name,
    needsCalibration: true,
    batchG: 385,
    chargeC: 180,
    dryEndC: 150,
    // Roast 7 dropped 1:31 after first crack (13.8 %); 1:45 (about 15.5 %) for a rounder cup.
    devTimeS: 105,
    capC: 200,
    curve: LIGHT_CURVE,
    phases: [
      SOAK,
      ...LIGHT_STEPS.map(({ name: phaseName, fanPct, next, ...step }) => ({
        name: phaseName,
        heat: heatFor({ name: phaseName, fanPct, next, ...step }),
        fanPct,
        next,
      })),
    ],
  });
}

/** The two Light styles (docs/spec/roast-control.md, Auto mode). */
export const SKYWALKER_PROFILES = {
  'light-steps': lightProfile(
    'light-steps',
    'Light · Steps',
    ({ heatPct, endC, durationS, rorMin, rorMax }) => ({
      mode: 'target',
      pct: heatPct,
      endC,
      durationS,
      rorMin,
      rorMax,
    }),
  ),
  'light-curve': lightProfile('light-curve', 'Light · Curve', ({ heatPct }) => ({
    mode: 'follow',
    pct: heatPct,
  })),
} as const satisfies Readonly<Record<string, AutoProfile>>;

/**
 * Cautious starting gains, set on the simulator and to be tuned on real roasts (`pid-tune`). They
 * move to the roaster record in milestone 5.
 */
export const SKYWALKER_TUNING: AutoTuning = AutoTuningSchema.parse({
  target: { kp: 1.5, ki: 0.02, kd: 0 },
  targetLimitPct: 20,
  // The shared defaults are the Skywalker's (ADR 0016).
  curveFollow: CURVE_FOLLOW_DEFAULTS,
  preheat: { kp: 5, ki: 0.02, kd: 0 },
  preheatFanPct: 30,
  holdS: 150,
  nextHoldS: 120,
  chargeCutS: 5,
});
