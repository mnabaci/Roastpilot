import { z } from 'zod';
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
});

export const RoastDetailSchema = RoastSummarySchema.extend({
  samples: z.array(SavedSampleSchema),
  events: z.array(SavedEventSchema),
});

export const StorageErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('not-found'), id: RoastIdSchema }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

export type RoastId = z.infer<typeof RoastIdSchema>;
export type RoastSummary = z.infer<typeof RoastSummarySchema>;
export type SavedSample = z.infer<typeof SavedSampleSchema>;
export type SavedEvent = z.infer<typeof SavedEventSchema>;
export type RoastDetail = z.infer<typeof RoastDetailSchema>;
export type StorageError = z.infer<typeof StorageErrorSchema>;
