import { createLogger } from '@roastpilot/core';
import { err, ok } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { createRoastFiles, type RoastFilesDeps } from './roast-files';

function setup(over: Partial<RoastFilesDeps> = {}) {
  const deps: RoastFilesDeps = {
    history: {
      exportCsv: vi.fn(() => Promise.resolve(ok('csv'))),
      importArtisan: vi.fn(() => Promise.resolve(ok(5))),
    },
    files: {
      exportFile: vi.fn(() => Promise.resolve(ok('{}'))),
      importFile: vi.fn(() => Promise.resolve(ok({ added: 2, skipped: 1 }))),
    },
    chooseExportPath: vi.fn(() => Promise.resolve('/tmp/roasts.json')),
    chooseImportPath: vi.fn(() => Promise.resolve('/tmp/roasts.json')),
    readText: vi.fn(() => Promise.resolve('{}')),
    writeText: vi.fn(() => Promise.resolve()),
    logger: createLogger({ write: () => undefined }, 'history'),
    ...over,
  };
  return { deps, files: createRoastFiles(deps) };
}

describe('roast files', () => {
  it('writes the chosen roasts as a Roastpilot file where you picked', async () => {
    const { deps, files } = setup();
    expect(await files.exportRoasts({ format: 'roastpilot', ids: [3, 4] })).toEqual(
      ok({ status: 'saved', fileName: 'roasts.json' }),
    );
    expect(deps.chooseExportPath).toHaveBeenCalledWith('roastpilot', 2);
    expect(deps.files.exportFile).toHaveBeenCalledWith([3, 4]);
    expect(deps.writeText).toHaveBeenCalledWith('/tmp/roasts.json', '{}');
  });

  it('writes every roast as CSV when none are named', async () => {
    const { deps, files } = setup();
    await files.exportRoasts({ format: 'csv' });
    expect(deps.chooseExportPath).toHaveBeenCalledWith('csv', 'all');
    expect(deps.history.exportCsv).toHaveBeenCalledWith(undefined);
  });

  it('does nothing when you cancel the picker', async () => {
    const { deps, files } = setup({ chooseExportPath: () => Promise.resolve(undefined) });
    expect(await files.exportRoasts({ format: 'csv' })).toEqual(ok({ status: 'cancelled' }));
    expect(deps.writeText).not.toHaveBeenCalled();
  });

  it('says so when the file cannot be written', async () => {
    const { files } = setup({ writeText: () => Promise.reject(new Error('read-only')) });
    expect(await files.exportRoasts({ format: 'roastpilot' })).toEqual(
      err({ kind: 'write-failed' }),
    );
  });

  it('imports a Roastpilot file and counts what came in and what was already here', async () => {
    const { files } = setup();
    expect(await files.importRoasts()).toEqual(ok({ status: 'imported', added: 2, skipped: 1 }));
  });

  it('says so when the file cannot be read', async () => {
    const { files } = setup({ readText: () => Promise.reject(new Error('gone')) });
    expect(await files.importRoasts()).toEqual(err({ kind: 'read-failed' }));
    expect(await files.importArtisan()).toEqual(err({ kind: 'read-failed' }));
  });

  it('asks for the right kind of file to import', async () => {
    const { deps, files } = setup();
    await files.importArtisan();
    expect(deps.chooseImportPath).toHaveBeenCalledWith('artisan');
    await files.importRoasts();
    expect(deps.chooseImportPath).toHaveBeenCalledWith('roastpilot');
  });
});
