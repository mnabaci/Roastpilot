import { z } from 'zod';
import { err, ok, type Result } from './result';

/**
 * Every Roastpilot file's kind: its `format`, the key its items sit under, its own `version` and
 * the screen that imports it (docs/spec/data-model.md, Beans, profiles and roasters files; ADR 0021).
 */
export const FILE_KINDS = {
  roasts: { format: 'roastpilot-roasts', version: 2, screen: 'History' },
  beans: { format: 'roastpilot-beans', version: 1, screen: 'Beans' },
  profiles: { format: 'roastpilot-profiles', version: 1, screen: 'Profiles' },
  roasters: { format: 'roastpilot-roasters', version: 1, screen: 'Roasters' },
} as const;

export type FileKind = keyof typeof FILE_KINDS;
export const FileKindSchema = z.enum(['roasts', 'beans', 'profiles', 'roasters']);

/** Why a whole file is refused before its items are read. */
export type EnvelopeProblem =
  | { kind: 'not-roastpilot' }
  | { kind: 'newer-version' }
  /** A Roastpilot file of another kind: import it on its own screen. */
  | { kind: 'wrong-kind'; fileKind: FileKind };

/** The items of a file of `kind`, and the version that wrote them. */
export interface Envelope {
  version: number;
  items: unknown[];
}

const EnvelopeSchema = z.object({
  format: z.string(),
  version: z.number().int().min(1),
  exportedAt: z.string(),
});

const kindOfFormat = (format: unknown): FileKind | undefined =>
  FileKindSchema.options.find((kind) => FILE_KINDS[kind].format === format);

/**
 * A file's envelope, checked: JSON, a Roastpilot format of this kind, a version this app reads,
 * and a list of items under the kind's key. The items themselves are the kind's reader's job.
 */
export function readEnvelope(text: string, kind: FileKind): Result<Envelope, EnvelopeProblem> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON at all: it isn't one of our files.
    return err({ kind: 'not-roastpilot' });
  }
  if (typeof json !== 'object' || json === null) return err({ kind: 'not-roastpilot' });
  const fileKind = kindOfFormat((json as { format?: unknown }).format);
  if (fileKind === undefined) return err({ kind: 'not-roastpilot' });
  if (fileKind !== kind) return err({ kind: 'wrong-kind', fileKind });
  const version = (json as { version?: unknown }).version;
  if (typeof version === 'number' && version > FILE_KINDS[kind].version) {
    return err({ kind: 'newer-version' });
  }
  const head = EnvelopeSchema.safeParse(json);
  const items = (json as Record<string, unknown>)[kind];
  if (!head.success || !Array.isArray(items)) return err({ kind: 'not-roastpilot' });
  return ok({ version: head.data.version, items: items as unknown[] });
}

/** What a file of kind `K` holds at its current version. */
export type FileOf<K extends FileKind, T> = {
  format: (typeof FILE_KINDS)[K]['format'];
  version: (typeof FILE_KINDS)[K]['version'];
  exportedAt: string;
} & Record<K, T>;

/** A file of `kind` at its current version: `{ format, version, exportedAt, <kind>: items }`. */
export function toEnvelope<K extends FileKind, T>(kind: K, items: T, now: Date): FileOf<K, T> {
  const { format, version } = FILE_KINDS[kind];
  // Key order is the file's: format, version, exportedAt, then the items.
  return { format, version, exportedAt: now.toISOString(), [kind]: items } as FileOf<K, T>;
}
