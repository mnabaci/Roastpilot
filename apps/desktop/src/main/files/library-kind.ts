import type { Logger } from '@roastpilot/core';
import {
  err,
  ok,
  toEnvelope,
  type ImportLibraryError,
  type LibraryItemId,
  type LibraryKind,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import { importFile } from './library-import';

/**
 * One kind of item as Roastpilot files carry it (the `Exporter` / `Importer` extension point,
 * docs/spec/extensibility.md): beans, profiles and roasters each implement it.
 */
export interface LibraryCodec<Item> {
  /** As the file carries them: every one here, or only those named. */
  exportItems(ids?: readonly LibraryItemId[]): Promise<Result<Item[], StorageError>>;
  /** One item from a file, checked as Save checks it; why it is refused otherwise. */
  readItem(item: unknown): Result<Item, string>;
  /** What is here now, as files carry it, to compare with; archived ones apart. */
  here(): Promise<Result<Here<Item>, StorageError>>;
  /** What counts as the same: the item without what an import sets anyway. */
  contentOf: (item: Item) => unknown;
  nameOf: (item: Item) => string;
  withName: (item: Item, name: string) => Item;
  /** The longest name this kind allows. */
  maxName: number;
  /** Adds them all at once, all or nothing; their ids in order. */
  addAll(items: readonly Item[]): Promise<Result<LibraryItemId[], StorageError>>;
}

/** What is here, as files carry it: shown, and archived (only beans archive). */
export interface Here<Item> {
  items: Item[];
  archived: Item[];
}

export interface LibraryImported {
  added: number;
  /** Already here and shown. */
  skipped: number;
  /** Already here, but archived. */
  archived: number;
  /** The last one added, for the screen to open; null when all were already here. */
  newestId: LibraryItemId | null;
}

/** A kind's files: written as text, and read back into the library. */
export interface LibraryFiles {
  /** The file's text; `not-found` when ids are given and none of them is here any more. */
  exportFile(
    ids?: readonly LibraryItemId[],
  ): Promise<Result<string, StorageError | { kind: 'not-found' }>>;
  importFile(text: string): Promise<Result<LibraryImported, ImportLibraryError>>;
}

/** A service's refusal as storage says it: adding imported items only ever fails to write. */
export const asStorageError = (error: { kind: string; message?: string }): StorageError => ({
  kind: 'storage-failed',
  message: error.message ?? error.kind,
});

/**
 * Export and import for one kind, the same flow for each (ADR 0021): export writes every item
 * as the file carries it; import is `importFile`.
 */
export function libraryFiles<Item>(
  kind: LibraryKind,
  codec: LibraryCodec<Item>,
  { now, logger }: { now: () => Date; logger: Logger },
): LibraryFiles {
  return {
    exportFile: async (ids) => {
      const items = await codec.exportItems(ids);
      if (!items.ok) {
        logger.warn('files.export-failed', { kind, error: items.error });
        return items;
      }
      // Gone since the screen asked: an empty file would only look like it worked.
      if (ids && items.value.length === 0) {
        logger.warn('files.export-not-found', { kind, ids });
        return err({ kind: 'not-found' });
      }
      logger.info('files.exported', { kind, items: items.value.length });
      // No indentation, as roast files: a file is for Roastpilot to read back.
      return ok(JSON.stringify(toEnvelope(kind, items.value, now())));
    },
    importFile: (text) => importFile(kind, codec, text, logger),
  };
}
