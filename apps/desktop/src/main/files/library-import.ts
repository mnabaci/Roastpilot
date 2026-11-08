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

/** A refusal names the item in at most this many characters, so the toast stays one line. */
const MAX_REFUSED_NAME = 40;

/** The name an item goes by in a refusal: its own, cut to fit, or its place in the file. */
export function itemName(item: unknown, index: number): string {
  const name = (item as { name?: unknown } | null)?.name;
  if (typeof name !== 'string' || name.trim() === '') return `Item ${String(index + 1)}`;
  const trimmed = name.trim();
  return trimmed.length > MAX_REFUSED_NAME
    ? `${trimmed.slice(0, MAX_REFUSED_NAME - 1).trimEnd()}…`
    : trimmed;
}

/** Every item checked; the first that fails refuses the whole file, as does a file with none. */
function readItems<Item>(
  codec: LibraryCodec<Item>,
  items: readonly unknown[],
): Result<Item[], ImportLibraryError> {
  if (items.length === 0) return err({ kind: 'empty' });
  const read: Item[] = [];
  for (const [index, item] of items.entries()) {
    const one = codec.readItem(item);
    if (!one.ok) return err({ kind: 'bad-item', name: itemName(item, index), reason: one.error });
    read.push(one.value);
  }
  return ok(read);
}

/** The file's items, checked; a refusal is logged, its temperatures in °C. */
function checkedItems<Item>(
  kind: LibraryKind,
  codec: LibraryCodec<Item>,
  text: string,
  logger: Logger,
): Result<Item[], ImportLibraryError> {
  const envelope = readEnvelope(text, kind);
  const items = envelope.ok ? readItems(codec, envelope.value.items) : envelope;
  if (!items.ok) {
    const reason =
      'reason' in items.error
        ? { ...items.error, reason: sayInUnit(items.error.reason, 'c') }
        : items.error;
    logger.warn('files.import-refused', { kind, reason });
  }
  return items;
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
  const items = checkedItems(kind, codec, text, logger);
  if (!items.ok) return items;
  const here = await codec.here();
  if (!here.ok) {
    logger.warn('files.import-failed', { kind, error: here.error });
    return here;
  }
  const { nameOf, withName, contentOf, maxName } = codec;
  const plan = planImport({
    items: items.value,
    here: here.value.items,
    archived: here.value.archived,
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
  const { skipped, archived } = plan;
  logger.info('files.imported', { kind, added: added.value.length, skipped, archived });
  return ok({ added: added.value.length, skipped, archived, newestId: added.value.at(-1) ?? null });
}
