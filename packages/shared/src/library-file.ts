import { z } from 'zod';
import { BeanFieldsSchema, BeanIdSchema } from './bean';
import { AutoProfileObjectSchema, ProfileIdSchema } from './profile';
import { checkProfile } from './profile-rules';
import { checkRoaster, RoasterIdSchema, RoasterObjectSchema } from './roaster';
import type { EnvelopeProblem } from './roastpilot-file';
import type { StorageError } from './saved-roast';

// Beans, profiles and roasters as Roastpilot files carry them: ids stay behind, links go by
// name (docs/spec/data-model.md, Beans, profiles and roasters files; ADR 0021).

/** The kinds the Beans, Profiles and Roasters screens move in and out. */
export const LibraryKindSchema = z.enum(['beans', 'profiles', 'roasters']);
export type LibraryKind = z.infer<typeof LibraryKindSchema>;

/** A bean's fields and its profile's name; not its stock or purchases, which are your bags. */
export const FileBeanSchema = BeanFieldsSchema.extend({
  profileName: z.string().min(1).nullable(),
});

/**
 * A profile in full, without its id, roaster or what it was made from (ids mean nothing on
 * another computer). The same rules as Save.
 */
export const FileProfileFieldsSchema = AutoProfileObjectSchema.omit({ id: true, source: true });
export const FileProfileSchema = FileProfileFieldsSchema.superRefine(checkProfile);

/** A roaster record without its id, its port (one computer's) or being the active one. */
export const FileRoasterFieldsSchema = RoasterObjectSchema.omit({
  id: true,
  connection: true,
  active: true,
});
export const FileRoasterSchema = FileRoasterFieldsSchema.superRefine(checkRoaster);

/**
 * What a file carries of something already stored: only the keys `schema` names, unchecked. It
 * passed its checks when it was saved, and today's rules (a lower model limit) must never stop an
 * export; incoming items are checked with the full schemas instead.
 */
export function fileFieldsOf<S extends z.ZodObject>(schema: S, stored: z.output<S>): z.output<S> {
  const keys = Object.keys(schema.shape);
  const kept = Object.entries(stored).filter(([key]) => keys.includes(key));
  return Object.fromEntries(kept) as z.output<S>;
}

/** Every item of the kind, or the ones named. */
export const ExportLibraryRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('beans'), ids: z.array(BeanIdSchema).min(1).optional() }),
  z.object({ kind: z.literal('profiles'), ids: z.array(ProfileIdSchema).min(1).optional() }),
  z.object({ kind: z.literal('roasters'), ids: z.array(RoasterIdSchema).min(1).optional() }),
]);

export const ImportLibraryRequestSchema = z.object({ kind: LibraryKindSchema });

/** A bean's or roaster's id (a number) or a profile's (a string). */
export type LibraryItemId = number | string;

export type ExportLibraryResult = { status: 'cancelled' } | { status: 'saved'; fileName: string };
export type ExportLibraryError =
  | StorageError
  | { kind: 'write-failed' }
  /** None of the ids asked for is here any more. */
  | { kind: 'not-found' };

export type ImportLibraryResult =
  | { status: 'cancelled' }
  /** `newestId`: the last one added, for the screen to open; null when all were already here. */
  | {
      status: 'imported';
      added: number;
      /** Already here and shown. */
      skipped: number;
      /** Already here, but archived, so hidden. */
      archived: number;
      newestId: LibraryItemId | null;
    };

/** One item that doesn't pass its checks: its name (or place in the file) and why. */
export interface BadItem {
  kind: 'bad-item';
  name: string;
  reason: string;
}

export type ImportLibraryError =
  | StorageError
  | { kind: 'read-failed' }
  | { kind: 'too-big' }
  /** A file with no items: nothing to import. */
  | { kind: 'empty' }
  | EnvelopeProblem
  | BadItem;

export type FileBean = z.infer<typeof FileBeanSchema>;
export type FileProfile = z.infer<typeof FileProfileSchema>;
export type FileRoaster = z.infer<typeof FileRoasterSchema>;
export type ExportLibraryRequest = z.infer<typeof ExportLibraryRequestSchema>;
export type ImportLibraryRequest = z.infer<typeof ImportLibraryRequestSchema>;
