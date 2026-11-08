import { silentLogger } from '@roastpilot/core';
import type { LibraryCodec } from './library-kind';
import { libraryFiles } from './library-kind';
import type { LibraryKind } from '@roastpilot/shared';

/** A kind's files on `codec`, on a fixed day and a quiet log, for the codec tests. */
export const filesOf = <Item>(kind: LibraryKind, codec: LibraryCodec<Item>) =>
  libraryFiles(kind, codec, {
    now: () => new Date('2026-11-08T10:00:00.000Z'),
    logger: silentLogger,
  });

/** The text of an export, or the test fails. */
export async function exported<Item>(
  kind: LibraryKind,
  codec: LibraryCodec<Item>,
  ids?: readonly (number | string)[],
): Promise<string> {
  const text = await filesOf(kind, codec).exportFile(ids);
  if (!text.ok) throw new Error(`export failed: ${text.error.kind}`);
  return text.value;
}

/** A copy of `value` without `keys`, as a file leaves them behind. */
export function without<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const kept = Object.entries(value).filter(([key]) => !(keys as PropertyKey[]).includes(key));
  return Object.fromEntries(kept) as Omit<T, K>;
}
