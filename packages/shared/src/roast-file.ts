import { z } from 'zod';
import { FILE_KINDS } from './roastpilot-file';
import { RoastDetailSchema, RoastIdSchema } from './saved-roast';

/** A Roastpilot roast file (docs/spec/data-model.md, Roastpilot roast files). */
export const ROAST_FILE_FORMAT = FILE_KINDS.roasts.format;
/** Version 2 keeps samples as columns (ADR 0015); version 1 files still import. */
export const ROAST_FILE_VERSION = FILE_KINDS.roasts.version;

/** One roast as a file carries it: ids stay behind, the bean and roaster go by name. */
export const FileRoastSchema = RoastDetailSchema.omit({
  id: true,
  roasterId: true,
  beanId: true,
  ghostRoastId: true,
  imported: true,
  profileId: true,
  profileName: true,
  // Read from the events, so files stay as they were.
  fcTemp: true,
}).extend({
  beanName: z.string().nullable(),
  roasterName: z.string().nullable(),
});

/** Version 1: every sample a row, `{ tS, values: { bt: 182.4, … } }`. */
export const RoastFileV1Schema = z.object({
  format: z.literal(ROAST_FILE_FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  roasts: z.array(FileRoastSchema),
});

/**
 * A roast's samples as columns: one list of times, and one list per channel in the same order,
 * `null` where that sample had no value. Every list is as long as `tS`.
 */
export const SampleColumnsSchema = z
  .object({
    tS: z.array(z.number()),
    values: z.record(z.string(), z.array(z.number().nullable())),
  })
  .refine((c) => Object.values(c.values).every((column) => column.length === c.tS.length), {
    message: 'Every channel has one value per time',
  });

/** A version 2 roast: samples as columns (ADR 0015). */
export const FileRoastV2Schema = FileRoastSchema.omit({ samples: true }).extend({
  samples: SampleColumnsSchema,
});

/** Version 2: the same roasts, samples as columns (ADR 0015). */
export const RoastFileV2Schema = z.object({
  format: z.literal(ROAST_FILE_FORMAT),
  version: z.literal(2),
  exportedAt: z.string(),
  roasts: z.array(FileRoastV2Schema),
});

export const RoastFileSchema = z.discriminatedUnion('version', [
  RoastFileV1Schema,
  RoastFileV2Schema,
]);

/** Which roasts to export, and how: every roast when `ids` is left out. */
export const ExportRoastsRequestSchema = z.object({
  format: z.enum(['csv', 'roastpilot']),
  ids: z.array(RoastIdSchema).optional(),
});

export const SetRoastBeanRequestSchema = z.object({
  id: RoastIdSchema,
  beanId: z.number().int().positive().nullable(),
});

export type FileRoast = z.infer<typeof FileRoastSchema>;
export type RoastFile = z.infer<typeof RoastFileSchema>;
export type RoastFileV2 = z.infer<typeof RoastFileV2Schema>;
export type SampleColumns = z.infer<typeof SampleColumnsSchema>;
export type ExportRoastsRequest = z.infer<typeof ExportRoastsRequestSchema>;
export type SetRoastBeanRequest = z.infer<typeof SetRoastBeanRequestSchema>;
