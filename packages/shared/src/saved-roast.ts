import { z } from 'zod';
import { AutoProfileSchema } from './profile';
import { RoastEventSchema } from './roast';

/** Saved roasts (docs/spec/data-model.md, Saving a roast). Times are seconds from charge. */
export const RoastIdSchema = z.number().int().positive();

export const RoastSummarySchema = z.object({
  id: RoastIdSchema,
  /** Wall-clock time of charge, ISO 8601. */
  startedAt: z.string(),
  /** When cooling ended; null for an unfinished roast. */
  endedAt: z.string().nullable(),
  fcTimeS: z.number().nullable(),
  dropTimeS: z.number().nullable(),
  dropTemp: z.number().nullable(),
});

/** One reading of a saved roast; negative `tS` is before charge (preheat). */
export const SavedSampleSchema = z.object({
  tS: z.number(),
  values: z.record(z.string(), z.number()),
});

export const SavedEventSchema = z.object({
  kind: RoastEventSchema.shape.kind,
  tS: z.number(),
  bt: z.number().nullable(),
  detail: z.string().optional(),
});

export const RoastDetailSchema = RoastSummarySchema.extend({
  mode: z.enum(['manual', 'auto']),
  /** The copy of the profile an Auto roast ran. */
  profile: AutoProfileSchema.nullable(),
  samples: z.array(SavedSampleSchema),
  events: z.array(SavedEventSchema),
});

export const StorageErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('not-found'), id: RoastIdSchema }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

/** Delete also refuses the roast being saved right now. */
export const DeleteRoastErrorSchema = z.union([
  StorageErrorSchema,
  z.object({ kind: z.literal('in-progress'), id: RoastIdSchema }),
]);

export type RoastId = z.infer<typeof RoastIdSchema>;
export type RoastSummary = z.infer<typeof RoastSummarySchema>;
export type SavedSample = z.infer<typeof SavedSampleSchema>;
export type SavedEvent = z.infer<typeof SavedEventSchema>;
export type RoastDetail = z.infer<typeof RoastDetailSchema>;
export type StorageError = z.infer<typeof StorageErrorSchema>;
export type DeleteRoastError = z.infer<typeof DeleteRoastErrorSchema>;
