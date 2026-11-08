import { createLogger } from '@roastpilot/core';
import { err, ok, type LibraryKind, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DialogParent } from './file-dialogs';
import { createLibraryFileActions, type LibraryFileActionsDeps } from './library-file-actions';
import type { LibraryFiles } from './library-kind';

/** The window that asked; the dialogs open on it. */
const WINDOW = { id: 1 } as unknown as DialogParent;

const kindFiles = (): LibraryFiles => ({
  exportFile: vi.fn(() => Promise.resolve(ok('{}'))),
  importFile: vi.fn(() => Promise.resolve(ok({ added: 3, skipped: 1, newestId: 9 }))),
});

function setup(over: Partial<LibraryFileActionsDeps> = {}) {
  const entries: LogEntry[] = [];
  const kinds: Record<LibraryKind, LibraryFiles> = {
    beans: kindFiles(),
    profiles: kindFiles(),
    roasters: kindFiles(),
  };
  const deps: LibraryFileActionsDeps = {
    kinds,
    chooseExportPath: vi.fn(() => Promise.resolve('/tmp/Roastpilot profiles.rpr')),
    chooseImportPath: vi.fn(() => Promise.resolve('/tmp/in.rpr')),
    readText: vi.fn(() => Promise.resolve('{"format":"x"}')),
    writeText: vi.fn(() => Promise.resolve()),
    logger: createLogger({ write: (e) => entries.push(e) }, 'files'),
    ...over,
  };
  return { deps, kinds, entries, actions: createLibraryFileActions(deps) };
}

describe('library file actions', () => {
  it('exports one item of a kind where you picked, and says the file name', async () => {
    const { deps, kinds, actions } = setup();
    expect(await actions.exportLibrary({ kind: 'profiles', ids: ['custom-1'] }, WINDOW)).toEqual(
      ok({ status: 'saved', fileName: 'Roastpilot profiles.rpr' }),
    );
    expect(deps.chooseExportPath).toHaveBeenCalledWith('profiles', 'roastpilot', 1, WINDOW);
    expect(kinds.profiles.exportFile).toHaveBeenCalledWith(['custom-1']);
    expect(deps.writeText).toHaveBeenCalledWith('/tmp/Roastpilot profiles.rpr', '{}');
  });

  it('exports all of a kind when none are named', async () => {
    const { deps, kinds, actions } = setup();
    await actions.exportLibrary({ kind: 'beans' }, WINDOW);
    expect(deps.chooseExportPath).toHaveBeenCalledWith('beans', 'roastpilot', 'all', WINDOW);
    expect(kinds.beans.exportFile).toHaveBeenCalledWith(undefined);
  });

  it('does nothing when you cancel either dialog', async () => {
    const { deps, kinds, actions } = setup({
      chooseExportPath: () => Promise.resolve(undefined),
      chooseImportPath: () => Promise.resolve(undefined),
    });
    expect(await actions.exportLibrary({ kind: 'roasters' }, WINDOW)).toEqual(
      ok({ status: 'cancelled' }),
    );
    expect(await actions.importLibrary('roasters', WINDOW)).toEqual(ok({ status: 'cancelled' }));
    expect(kinds.roasters.exportFile).not.toHaveBeenCalled();
    expect(deps.readText).not.toHaveBeenCalled();
  });

  it('says why an export could not be read from storage, writing nothing', async () => {
    const failed = err({ kind: 'storage-failed' as const, message: 'gone' });
    const { deps, kinds, actions } = setup();
    vi.mocked(kinds.beans.exportFile).mockResolvedValue(failed);
    expect(await actions.exportLibrary({ kind: 'beans' }, WINDOW)).toEqual(failed);
    expect(deps.writeText).not.toHaveBeenCalled();
  });

  it('says so when the file cannot be written, logged', async () => {
    const { actions, entries } = setup({ writeText: () => Promise.reject(new Error('read-only')) });
    expect(await actions.exportLibrary({ kind: 'beans' }, WINDOW)).toEqual(
      err({ kind: 'write-failed' }),
    );
    expect(entries.map((e) => e.event)).toEqual(['files.export-write-failed']);
  });

  it('imports the picked file into its kind, on the window that asked', async () => {
    const { deps, kinds, actions } = setup();
    expect(await actions.importLibrary('profiles', WINDOW)).toEqual(
      ok({ status: 'imported', added: 3, skipped: 1, newestId: 9 }),
    );
    expect(deps.chooseImportPath).toHaveBeenCalledWith('profiles', WINDOW);
    expect(kinds.profiles.importFile).toHaveBeenCalledWith('{"format":"x"}');
  });

  it('passes a refusal on as it is', async () => {
    const refused = err({ kind: 'wrong-kind' as const, fileKind: 'beans' as const });
    const { kinds, actions } = setup();
    vi.mocked(kinds.profiles.importFile).mockResolvedValue(refused);
    expect(await actions.importLibrary('profiles', WINDOW)).toEqual(refused);
  });

  it('says so when the file cannot be read, logged', async () => {
    const { actions, entries } = setup({ readText: () => Promise.reject(new Error('gone')) });
    expect(await actions.importLibrary('beans', WINDOW)).toEqual(err({ kind: 'read-failed' }));
    expect(entries.map((e) => e.event)).toEqual(['files.import-read-failed']);
  });
});
