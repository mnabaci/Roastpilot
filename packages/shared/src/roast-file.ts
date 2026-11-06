import { z } from 'zod';
import { RoastDetailSchema, RoastIdSchema } from './saved-roast';

/** A Roastpilot roast file (docs/spec/data-model.md, Roastpilot roast files). */
export const ROAST_FILE_FORMAT = 'roastpilot-roasts';
export const ROAST_FILE_VERSION = 1;

/** One roast as a file carries it: ids stay behind, the bean and roaster go by name. */
export const FileRoastSchema = RoastDetailSchema.omit({
  id: true,
  roasterId: true,
  beanId: true,
  ghostRoastId: true,
  imported: true,
  profileId: true,
  profileName: true,
}).extend({
  beanName: z.string().nullable(),
  roasterName: z.string().nullable(),
});

export const RoastFileSchema = z.object({
  format: z.literal(ROAST_FILE_FORMAT),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  roasts: z.array(FileRoastSchema),
});

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
export type ExportRoastsRequest = z.infer<typeof ExportRoastsRequestSchema>;
export type SetRoastBeanRequest = z.infer<typeof SetRoastBeanRequestSchema>;
