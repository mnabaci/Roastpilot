import { z } from 'zod';

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
  /** The PID sets the heater 0–100% to track the curve; `pct` is its starting value. */
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

export const ProfileIdSchema = z.enum(['light-steps', 'light-curve']);

/** A roast plan for one roaster (docs/spec/roast-control.md, Profile format). */
export const AutoProfileSchema = z
  .object({
    schemaVersion: z.literal(PROFILE_SCHEMA_VERSION),
    id: ProfileIdSchema,
    name: z.string().min(1),
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
  .superRefine((profile, ctx) => {
    const lastIndex = profile.phases.length - 1;
    profile.phases.forEach((phase, index) => {
      if (
        phase.heat.mode === 'target' &&
        phase.next.on === 'bt' &&
        phase.heat.endC !== phase.next.c
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'heat', 'endC'],
          message: 'a target step must end at the temperature that starts the next phase',
        });
      }
      if ((phase.next.on === 'end') !== (index === lastIndex)) {
        ctx.addIssue({
          code: 'custom',
          path: ['phases', index, 'next'],
          message: 'only the last phase, and always the last phase, ends with the end rule',
        });
      }
    });
    profile.curve.slice(1).forEach((point, index) => {
      const previous = profile.curve[index];
      if (previous && point.tS <= previous.tS) {
        ctx.addIssue({
          code: 'custom',
          path: ['curve', index + 1, 'tS'],
          message: 'curve points must go forward in time',
        });
      }
    });
  });

/** One PID's gains. Output in % per unit of error. */
export const PidGainsSchema = z.object({
  kp: z.number().nonnegative(),
  ki: z.number().nonnegative(),
  kd: z.number().nonnegative(),
});

/**
 * What Auto needs to know about the roaster beyond its profiles; moves to the roaster record in
 * milestone 5 (docs/adr/0011-built-in-profile-as-data.md).
 */
export const AutoTuningSchema = z.object({
  /** On RoR error (°C/min), for `target` phases. */
  target: PidGainsSchema,
  /** At most this many % above or below the heater estimate. */
  targetLimitPct: z.number().positive(),
  /** On temperature error (°C), for `follow` phases. */
  follow: PidGainsSchema,
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
