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
export const RoastActionSchema = z.enum([
  'preheat',
  'start',
  'first-crack',
  'drop',
  'clear',
  'end',
  /** +1 min on the cooling countdown. */
  'extend-cooling',
  /** Roaster cool-down from Ready or Done (docs/spec/manual-mode.md, Roaster cool-down). */
  'cool-roaster',
  'stop-cooling-roaster',
]);

export const RoastEventSchema = z.object({
  kind: z.enum(['charge', 'turning-point', 'first-crack', 'drop', 'cool-end', 'end']),
  atMs: z.number(),
  /** Bean temperature when it happened; null if there was no reading yet. */
  bt: z.number().nullable(),
});

export const RoastStateSchema = z.object({
  phase: RoastPhaseSchema,
  /** When Preheat was pressed; null if the roast started without it (Full control). */
  preheatAtMs: z.number().nullable(),
  /** The charge point: the reading before the charge drop, or when Start was pressed. */
  chargedAtMs: z.number().nullable(),
  /** When Start was pressed; later than `chargedAtMs` when the charge point was found earlier. */
  startPressedAtMs: z.number().nullable(),
  firstCrackAtMs: z.number().nullable(),
  droppedAtMs: z.number().nullable(),
  coolingEndsAtMs: z.number().nullable(),
  events: z.array(RoastEventSchema),
  /** When the roaster cool-down began; null when it isn't running. */
  roasterCoolingSinceMs: z.number().nullable(),
});

/** No roast yet: what the app starts with and Clear goes back to. */
export const READY_ROAST: RoastState = {
  phase: 'ready',
  preheatAtMs: null,
  chargedAtMs: null,
  startPressedAtMs: null,
  firstCrackAtMs: null,
  droppedAtMs: null,
  coolingEndsAtMs: null,
  events: [],
  roasterCoolingSinceMs: null,
};

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
