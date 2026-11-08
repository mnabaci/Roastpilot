import type { Logger } from '@roastpilot/core';
import {
  err,
  ok,
  readEnvelope,
  toEnvelope,
  type ImportLibraryError,
  type LibraryItemId,
  type LibraryKind,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import { planImport } from './import-plan';

/**
 * One kind of item as Roastpilot files carry it (the `Exporter` / `Importer` extension point,
 * docs/spec/extensibility.md): beans, profiles and roasters each implement it.
 */
export interface LibraryCodec<Item> {
  /** As the file carries them: every one here, or only those named. */
  exportItems(ids?: readonly LibraryItemId[]): Promise<Result<Item[], StorageError>>;
  /** One item from a file, checked as Save checks it; why it is refused otherwise. */
  readItem(item: unknown): Result<Item, string>;
  /** What is here now, as files carry it, to compare with. */
  here(): Promise<Result<Item[], StorageError>>;
  /** What counts as the same: the item without what an import sets anyway. */
  contentOf: (item: Item) => unknown;
  nameOf: (item: Item) => string;
  withName: (item: Item, name: string) => Item;
  /** The longest name this kind allows. */
  maxName: number;
  /** Adds them all at once, all or nothing; their ids in order. */
  addAll(items: readonly Item[]): Promise<Result<LibraryItemId[], StorageError>>;
}

export interface LibraryImported {
  added: number;
  skipped: number;
  /** The last one added, for the screen to open; null when all were already here. */
  newestId: LibraryItemId | null;
}

/** A kind's files: written as text, and read back into the library. */
export interface LibraryFiles {
  exportFile(ids?: readonly LibraryItemId[]): Promise<Result<string, StorageError>>;
  importFile(text: string): Promise<Result<LibraryImported, ImportLibraryError>>;
}

/** A service's refusal as storage says it: adding imported items only ever fails to write. */
export const asStorageError = (error: { kind: string; message?: string }): StorageError => ({
  kind: 'storage-failed',
  message: error.message ?? error.kind,
});

/** The name an item goes by in a refusal: its own, or its place in the file. */
const itemName = (item: unknown, index: number): string => {
  const name = (item as { name?: unknown } | null)?.name;
  return typeof name === 'string' && name.trim() !== '' ? name : `#${String(index + 1)}`;
};

/** Every item checked; the first that fails refuses the whole file. */
function readItems<Item>(
  codec: LibraryCodec<Item>,
  items: readonly unknown[],
): Result<Item[], ImportLibraryError> {
  const read: Item[] = [];
  for (const [index, item] of items.entries()) {
    const one = codec.readItem(item);
    if (!one.ok) return err({ kind: 'bad-item', name: itemName(item, index), reason: one.error });
    read.push(one.value);
  }
  return ok(read);
}

/**
 * Export and import for one kind, the same flow for each (ADR 0021): the envelope first, then
 * every item checked, then the skip-or-rename plan, then one all-or-nothing write.
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
      logger.info('files.exported', { kind, items: items.value.length });
      // No indentation, as roast files: a file is for Roastpilot to read back.
      return ok(JSON.stringify(toEnvelope(kind, items.value, now())));
    },
    importFile: async (text) => {
      const envelope = readEnvelope(text, kind);
      const items = envelope.ok ? readItems(codec, envelope.value.items) : envelope;
      if (!items.ok) {
        logger.warn('files.import-refused', { kind, reason: items.error });
        return items;
      }
      const here = await codec.here();
      if (!here.ok) {
        logger.warn('files.import-failed', { kind, error: here.error });
        return here;
      }
      const { nameOf, withName, contentOf, maxName } = codec;
      const plan = planImport({
        items: items.value,
        here: here.value,
        nameOf,
        withName,
        contentOf,
        maxName,
      });
      const added = plan.add.length > 0 ? await codec.addAll(plan.add) : ok([]);
      if (!added.ok) {
        logger.warn('files.import-failed', { kind, error: added.error });
        return added;
      }
      logger.info('files.imported', { kind, added: added.value.length, skipped: plan.skipped });
      return ok({
        added: added.value.length,
        skipped: plan.skipped,
        newestId: added.value.at(-1) ?? null,
      });
    },
  };
}
