import { z } from 'zod';
import { DEFAULT_PROFILE_ID, ProfileIdSchema } from './profile';

/** Who sets one output: Auto, or you until Resume auto. */
export const OutputOwnerSchema = z.enum(['auto', 'manual']);

/** Where the between-batch preheat is (docs/spec/roast-control.md, Roast phases end to end). */
export const PreheatStepSchema = z.enum([
  'cool',
  'climb',
  'hold',
  'add-beans',
  'charge-cut',
  'beans-in',
]);

/** What Auto is doing, for the window. */
export const AutoStatusSchema = z.object({
  enabled: z.boolean(),
  profileId: ProfileIdSchema,
  /** A stop handed the outputs to you; Resume auto takes them back. */
  stopped: z.boolean(),
  heater: OutputOwnerSchema,
  fan: OutputOwnerSchema,
  preheatStep: PreheatStepSchema.nullable(),
  /** Seconds left on the hold or the charge countdown; null otherwise. */
  preheatLeftS: z.number().nullable(),
  /** The profile phase running; null outside the roast. */
  phaseName: z.string().nullable(),
  /** The temperature that starts the next phase; null when it isn't a temperature. */
  nextPhaseAtC: z.number().nullable(),
  stallTripped: z.boolean(),
});

/** Auto is off: what a window shows before main has said anything. */
export const AUTO_OFF: z.infer<typeof AutoStatusSchema> = {
  enabled: false,
  profileId: DEFAULT_PROFILE_ID,
  stopped: false,
  heater: 'auto',
  fan: 'auto',
  preheatStep: null,
  preheatLeftS: null,
  phaseName: null,
  nextPhaseAtC: null,
  stallTripped: false,
};

export const AutoResumeErrorSchema = z.object({ kind: z.literal('safety-locked') });
export const AutoChargeSoonErrorSchema = z.object({ kind: z.literal('not-now') });

export type OutputOwner = z.infer<typeof OutputOwnerSchema>;
export type PreheatStep = z.infer<typeof PreheatStepSchema>;
export type AutoStatus = z.infer<typeof AutoStatusSchema>;
export type AutoResumeError = z.infer<typeof AutoResumeErrorSchema>;
export type AutoChargeSoonError = z.infer<typeof AutoChargeSoonErrorSchema>;
