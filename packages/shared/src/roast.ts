import { z } from 'zod';

/** States of a manual roast (docs/spec/manual-mode.md, Manual roast flow). */
export const RoastPhaseSchema = z.enum([
  'ready',
  'preheat',
  'roasting',
  'development',
  'cooling',
  'done',
]);
export const RoastActionSchema = z.enum(['preheat', 'start', 'first-crack', 'drop']);

export const RoastEventSchema = z.object({
  kind: z.enum(['charge', 'first-crack', 'drop', 'cool-end']),
  atMs: z.number(),
  /** Bean temperature when it happened; null if there was no reading yet. */
  bt: z.number().nullable(),
});

export const RoastStateSchema = z.object({
  phase: RoastPhaseSchema,
  chargedAtMs: z.number().nullable(),
  firstCrackAtMs: z.number().nullable(),
  droppedAtMs: z.number().nullable(),
  coolingEndsAtMs: z.number().nullable(),
  events: z.array(RoastEventSchema),
});

export const RoastActionErrorSchema = z.object({
  kind: z.literal('not-allowed'),
  action: RoastActionSchema,
  phase: RoastPhaseSchema,
});

export type RoastPhase = z.infer<typeof RoastPhaseSchema>;
export type RoastAction = z.infer<typeof RoastActionSchema>;
export type RoastEvent = z.infer<typeof RoastEventSchema>;
export type RoastState = z.infer<typeof RoastStateSchema>;
export type RoastActionError = z.infer<typeof RoastActionErrorSchema>;
