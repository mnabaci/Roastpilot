import { z } from 'zod';
import { checkProfile } from './profile-rules';

export { PROFILE_LIMITS } from './profile-rules';

/** Bumped when the saved format changes, so a roast's copy of its profile stays readable. */
export const PROFILE_SCHEMA_VERSION = 1;

const PercentSchema = z.number().min(0).max(100);

/** How a phase controls the heater (docs/spec/roast-control.md, Heat control). */
export const PhaseHeatSchema = z.discriminatedUnion('mode', [
  /** Exactly this %, no correction: the soak. */
  z.object({ mode: z.literal('fixed'), pct: PercentSchema }),
  /** Reach `endC` in `durationS`, RoR inside the range; `pct` is the heater's starting estimate. */
  z
    .object({
      mode: z.literal('target'),
      pct: PercentSchema,
      endC: z.number(),
      durationS: z.number().positive(),
      rorMin: z.number(),
      rorMax: z.number(),
    })
    .refine((heat) => heat.rorMin < heat.rorMax, { message: 'rorMin must be below rorMax' }),
  /** Hold the curve's own RoR; `pct` is the heater's starting estimate (ADR 0016). */
  z.object({ mode: z.literal('follow'), pct: PercentSchema }),
]);

/** What starts the next phase; `end` is the last phase, which only the end rule finishes. */
export const PhaseNextSchema = z.discriminatedUnion('on', [
  z.object({ on: z.literal('time'), afterS: z.number().positive() }),
  /** BT reaches `c`, or `backupS` after charge passes, whichever comes first. */
  z.object({ on: z.literal('bt'), c: z.number(), backupS: z.number().positive() }),
  z.object({ on: z.literal('end') }),
]);

export const ProfilePhaseSchema = z.object({
  name: z.string().min(1),
  heat: PhaseHeatSchema,
  fanPct: PercentSchema,
  next: PhaseNextSchema,
});

/** One point of the target curve: seconds since charge and the temperature expected then. */
export const CurvePointSchema = z.object({ tS: z.number().nonnegative(), c: z.number() });

/** Built-ins have fixed ids; your own get a generated one. */
export const ProfileIdSchema = z.string().min(1).max(64);

/**
 * How long a profile's soak can run, in seconds; no soak at all is the other choice
 * (docs/spec/roast-control.md, The soak is part of each profile).
 */
export const SOAK_LENGTHS_S = [30, 45, 60, 75, 90, 120] as const;

/** The profile Auto falls back to when the chosen one is gone. */
export const DEFAULT_PROFILE_ID = 'light-steps';

export const ProfileSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('profile'), profileId: ProfileIdSchema }),
  z.object({ kind: z.literal('roast'), roastId: z.number().int().positive() }),
]);

/** A roast plan for one roaster (docs/spec/roast-control.md, Profile format). */
export const AutoProfileSchema = z
  .object({
    schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
    id: ProfileIdSchema,
    name: z.string().min(1),
    /** What your own profile was made from. */
    source: ProfileSourceSchema.optional(),
    needsCalibration: z.boolean(),
    batchG: z.number().positive(),
    chargeC: z.number(),
    dryEndC: z.number(),
    /** Drop this long after your first-crack tap. */
    devTimeS: z.number().positive(),
    /** Drop at this temperature, whatever the time. */
    capC: z.number(),
    curve: z.array(CurvePointSchema).min(2),
    phases: z.array(ProfilePhaseSchema).min(1),
  })
  .superRefine(checkProfile);

/** One PID's gains. Output in % per unit of error. */
export const PidGainsSchema = z.object({
  kp: z.number().nonnegative(),
  ki: z.number().nonnegative(),
  kd: z.number().nonnegative(),
});

/** How `follow` phases trace the curve (docs/spec/roast-control.md, Heat control; ADR 0016). */
export const CurveFollowSchema = z.object({
  /** On RoR error (°C/min). */
  gains: PidGainsSchema,
  /** At most this many % above or below the heater estimate. */
  limitPct: z.number().positive(),
  /** Aim for the curve's RoR this many seconds ahead, to cover the drum's lag. */
  lookAheadS: z.number().nonnegative(),
  /** °C/min more RoR for each °C BT is behind the curve. */
  pullPerC: z.number().nonnegative(),
  /** The heater moves at most this many % per 10 s, either way. */
  slewPctPer10s: z.number().positive(),
});

/**
 * The Skywalker's starting values, the one real model so far. A record saved before curve phases
 * followed RoR reads with these.
 */
export const CURVE_FOLLOW_DEFAULTS: CurveFollow = {
  gains: { kp: 1.5, ki: 0.02, kd: 0 },
  limitPct: 20,
  lookAheadS: 30,
  pullPerC: 0.3,
  slewPctPer10s: 5,
};

/**
 * What Auto needs to know about the roaster beyond its profiles; moves to the roaster record in
 * milestone 5 (docs/adr/0011-built-in-profile-as-data.md).
 */
export const AutoTuningSchema = z.object({
  /** On RoR error (°C/min), for `target` phases. */
  target: PidGainsSchema,
  /** At most this many % above or below the heater estimate. */
  targetLimitPct: z.number().positive(),
  /** For `follow` phases. The old temperature-error `follow` gains are dropped on read. */
  curveFollow: CurveFollowSchema.default(() => CURVE_FOLLOW_DEFAULTS),
  /** On temperature error (°C), for the preheat climb and hold. */
  preheat: PidGainsSchema,
  preheatFanPct: PercentSchema,
  /** How long the preheat holds at charge temperature before "Add beans". */
  holdS: z.number().positive(),
  /** The countdown between Charge soon and "Beans in", with the heater at 0. */
  chargeCutS: z.number().nonnegative(),
});

export type PhaseHeat = z.infer<typeof PhaseHeatSchema>;
export type PhaseNext = z.infer<typeof PhaseNextSchema>;
export type ProfilePhase = z.infer<typeof ProfilePhaseSchema>;
export type CurvePoint = z.infer<typeof CurvePointSchema>;
export type ProfileId = z.infer<typeof ProfileIdSchema>;
export type AutoProfile = z.infer<typeof AutoProfileSchema>;
export type PidGains = z.infer<typeof PidGainsSchema>;
export type AutoTuning = z.infer<typeof AutoTuningSchema>;
export type CurveFollow = z.infer<typeof CurveFollowSchema>;

/** A profile as the Profiles screen lists it. */
export const ProfileEntrySchema = z.object({
  profile: AutoProfileSchema,
  builtIn: z.boolean(),
});

export const ProfileErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('built-in'), id: ProfileIdSchema }),
  z.object({ kind: z.literal('not-found'), id: ProfileIdSchema }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;
export type ProfileError = z.infer<typeof ProfileErrorSchema>;
