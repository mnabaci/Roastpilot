import { createLogger } from '@roastpilot/core';
import { err, ok, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { libraryFiles, type LibraryCodec } from './library-kind';

interface Thing {
  name: string;
  size: number;
}

const FAILED = err({ kind: 'storage-failed' as const, message: 'disk full' });
const NOW = new Date('2026-11-08T10:00:00.000Z');

/** A kind of named things with a size; ids count up from 10. */
function setup(
  here: Thing[] = [],
  over: Partial<LibraryCodec<Thing>> = {},
  archived: Thing[] = [],
) {
  const codec: LibraryCodec<Thing> = {
    exportItems: vi.fn(() => Promise.resolve(ok(here))),
    readItem: (item) => {
      const thing = item as Partial<Thing> | null;
      if (typeof thing?.name !== 'string') return err('Enter a name');
      if (typeof thing.size !== 'number' || thing.size <= 0) return err('Must be above 0');
      return ok({ name: thing.name, size: thing.size });
    },
    here: () => Promise.resolve(ok({ items: here, archived })),
    contentOf: ({ size }) => ({ size }),
    nameOf: (thing) => thing.name,
    withName: (thing, name) => ({ ...thing, name }),
    maxName: 64,
    addAll: vi.fn((items: readonly Thing[]) => Promise.resolve(ok(items.map((_, i) => 10 + i)))),
    ...over,
  };
  const entries: LogEntry[] = [];
  const files = libraryFiles('beans', codec, {
    now: () => NOW,
    logger: createLogger({ write: (e) => entries.push(e) }, 'files'),
  });
  return { codec, files, entries };
}

const beansFile = (beans: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'roastpilot-beans', version: 1, exportedAt: '', beans, ...over });

describe('library files', () => {
  it('writes the kind envelope around the items, without indentation', async () => {
    const { files, codec } = setup([{ name: 'Guji', size: 1 }]);
    expect(await files.exportFile([3])).toEqual(
      ok(
        '{"format":"roastpilot-beans","version":1,"exportedAt":"2026-11-08T10:00:00.000Z","beans":[{"name":"Guji","size":1}]}',
      ),
    );
    expect(codec.exportItems).toHaveBeenCalledWith([3]);
  });

  it('an export that cannot read says why, logged', async () => {
    const { files, entries } = setup([], { exportItems: () => Promise.resolve(FAILED) });
    expect(await files.exportFile()).toEqual(FAILED);
    expect(entries.map((e) => e.event)).toContain('files.export-failed');
  });

  it('adds what is new and counts what was already here; the newest is the last added', async () => {
    const { files, codec } = setup([
      { name: 'Guji', size: 1 },
      { name: 'Huila', size: 1 },
    ]);
    const text = beansFile([
      { name: 'Guji', size: 1 },
      { name: 'Huila', size: 2 },
      { name: 'Kenya', size: 3 },
    ]);
    expect(await files.importFile(text)).toEqual(
      ok({ added: 2, skipped: 1, archived: 0, newestId: 11 }),
    );
    expect(codec.addAll).toHaveBeenCalledWith([
      { name: 'Huila (imported)', size: 2 },
      { name: 'Kenya', size: 3 },
    ]);
  });

  it('writes nothing when everything was already here', async () => {
    const { files, codec } = setup([{ name: 'Guji', size: 1 }]);
    expect(await files.importFile(beansFile([{ name: 'Guji', size: 1 }]))).toEqual(
      ok({ added: 0, skipped: 1, archived: 0, newestId: null }),
    );
    expect(codec.addAll).not.toHaveBeenCalled();
  });

  it.each([
    ['not JSON', 'nope', { kind: 'not-roastpilot' }],
    ['another JSON file', '{"name":"package"}', { kind: 'not-roastpilot' }],
    ['a newer version', beansFile([], { version: 2 }), { kind: 'newer-version' }],
    [
      'another kind, by name',
      JSON.stringify({ format: 'roastpilot-profiles', version: 1, exportedAt: '', profiles: [] }),
      { kind: 'wrong-kind', fileKind: 'profiles' },
    ],
    [
      'a bad item, by its name',
      beansFile([
        { name: 'Guji', size: 1 },
        { name: 'Huila', size: 0 },
      ]),
      { kind: 'bad-item', name: 'Huila', reason: 'Must be above 0' },
    ],
    ['an empty file', beansFile([]), { kind: 'empty' }],
    [
      'a long name, cut to 40 characters',
      beansFile([{ name: `${'Ethiopia Guji Hambela Natural '.repeat(3)}lot 7`, size: 0 }]),
      {
        kind: 'bad-item',
        name: 'Ethiopia Guji Hambela Natural Ethiopia…',
        reason: 'Must be above 0',
      },
    ],
    [
      'a bad item without a name, by its place',
      beansFile([{ name: 'Guji', size: 1 }, { size: 2 }]),
      { kind: 'bad-item', name: 'Item 2', reason: 'Enter a name' },
    ],
  ])('refuses the whole file: %s', async (_, text, error) => {
    const { files, codec, entries } = setup();
    expect(await files.importFile(text)).toEqual(err(error));
    expect(codec.addAll).not.toHaveBeenCalled();
    expect(entries.map((e) => e.event)).toEqual(['files.import-refused']);
  });

  it('says why when what is here cannot be read, and adds nothing', async () => {
    const { files, codec } = setup([], { here: () => Promise.resolve(FAILED) });
    expect(await files.importFile(beansFile([{ name: 'Guji', size: 1 }]))).toEqual(FAILED);
    expect(codec.addAll).not.toHaveBeenCalled();
  });

  it('says why when the write fails', async () => {
    const { files, entries } = setup([], { addAll: () => Promise.resolve(FAILED) });
    expect(await files.importFile(beansFile([{ name: 'Guji', size: 1 }]))).toEqual(FAILED);
    expect(entries.map((e) => e.event)).toContain('files.import-failed');
  });

  it('an export of ids that are all gone says not found, rather than save an empty file', async () => {
    const { files, entries } = setup([]);
    expect(await files.exportFile([3])).toEqual(err({ kind: 'not-found' }));
    expect(entries.map((e) => e.event)).toContain('files.export-not-found');
    // Export all of nothing is still a file.
    expect((await files.exportFile()).ok).toBe(true);
  });

  it('two different items with the same name in one file: the second comes in "(imported)"', async () => {
    const { files, codec } = setup();
    const text = beansFile([
      { name: 'Guji', size: 1 },
      { name: 'Guji', size: 2 },
    ]);
    expect(await files.importFile(text)).toEqual(
      ok({ added: 2, skipped: 0, archived: 0, newestId: 11 }),
    );
    expect(codec.addAll).toHaveBeenCalledWith([
      { name: 'Guji', size: 1 },
      { name: 'Guji (imported)', size: 2 },
    ]);
  });

  it('counts what matches an archived item apart from what was already here', async () => {
    const { files } = setup([{ name: 'Huila', size: 1 }], {}, [{ name: 'Guji', size: 1 }]);
    const text = beansFile([
      { name: 'Guji', size: 1 },
      { name: 'Huila', size: 1 },
      { name: 'Kenya', size: 1 },
    ]);
    expect(await files.importFile(text)).toEqual(
      ok({ added: 1, skipped: 1, archived: 1, newestId: 10 }),
    );
  });
});
