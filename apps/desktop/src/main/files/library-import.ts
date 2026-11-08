import type { Logger } from '@roastpilot/core';
import {
  err,
  ok,
  readEnvelope,
  sayInUnit,
  type ImportLibraryError,
  type LibraryKind,
  type Result,
} from '@roastpilot/shared';
import { planImport } from './import-plan';
import type { LibraryCodec, LibraryImported } from './library-kind';

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
 * One file of `kind` into the library (ADR 0021): the envelope first, then every item checked,
 * then the skip-or-rename plan, then one all-or-nothing write.
 */
export async function importFile<Item>(
  kind: LibraryKind,
  codec: LibraryCodec<Item>,
  text: string,
  logger: Logger,
): Promise<Result<LibraryImported, ImportLibraryError>> {
  const envelope = readEnvelope(text, kind);
  const items = envelope.ok ? readItems(codec, envelope.value.items) : envelope;
  if (!items.ok) {
    // A refused item's reason carries temperature tokens: the log says them in °C.
    const reason =
      'reason' in items.error
        ? { ...items.error, reason: sayInUnit(items.error.reason, 'c') }
        : items.error;
    logger.warn('files.import-refused', { kind, reason });
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
}
