import { z } from 'zod';
import { ProfileIdSchema } from './profile';

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

export const AutoResumeErrorSchema = z.object({ kind: z.literal('safety-locked') });
export const AutoChargeSoonErrorSchema = z.object({ kind: z.literal('not-now') });

export type OutputOwner = z.infer<typeof OutputOwnerSchema>;
export type PreheatStep = z.infer<typeof PreheatStepSchema>;
export type AutoStatus = z.infer<typeof AutoStatusSchema>;
export type AutoResumeError = z.infer<typeof AutoResumeErrorSchema>;
export type AutoChargeSoonError = z.infer<typeof AutoChargeSoonErrorSchema>;
