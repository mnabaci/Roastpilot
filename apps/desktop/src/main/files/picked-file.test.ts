import { createLogger } from '@roastpilot/core';
import { err, ok, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { MAX_PICKED_BYTES, readPicked, writePicked, type PickedFileDeps } from './picked-file';

/** A file system of one folder in memory; `over` replaces a call to make it fail. */
function disk(files: Record<string, string> = {}, over: Partial<PickedFileDeps> = {}) {
  const entries: LogEntry[] = [];
  const deps: PickedFileDeps = {
    readText: vi.fn((path: string) => {
      const text = files[path];
      return text === undefined ? Promise.reject(new Error('ENOENT')) : Promise.resolve(text);
    }),
    writeText: (path, text) => {
      files[path] = text;
      return Promise.resolve();
    },
    sizeOf: (path) => {
      const text = files[path];
      return text === undefined
        ? Promise.reject(new Error('ENOENT'))
        : Promise.resolve(text.length);
    },
    rename: (from, to) => {
      const text = files[from];
      if (text === undefined) return Promise.reject(new Error('ENOENT'));
      files[to] = text;
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- a fake folder keyed by path
      delete files[from];
      return Promise.resolve();
    },
    remove: (path) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- a fake folder keyed by path
      delete files[path];
      return Promise.resolve();
    },
    logger: createLogger({ write: (e) => entries.push(e) }, 'files'),
    ...over,
  };
  const events = () => entries.map((e) => e.event);
  return { deps, files, events };
}

describe('the picked file', () => {
  it('reads a file', async () => {
    const { deps } = disk({ '/a.rpr': 'text' });
    expect(await readPicked('/a.rpr', deps, 'files.read-failed')).toEqual(ok('text'));
  });

  it('refuses a file over 50 MB without reading it, logged', async () => {
    const { deps, events } = disk({}, { sizeOf: () => Promise.resolve(MAX_PICKED_BYTES + 1) });
    expect(await readPicked('/big.rpr', deps, 'files.read-failed')).toEqual(
      err({ kind: 'too-big' }),
    );
    expect(deps.readText).not.toHaveBeenCalled();
    expect(events()).toEqual(['files.read-failed']);
  });

  it('reads one of exactly 50 MB', async () => {
    const { deps } = disk(
      { '/a.rpr': 'text' },
      { sizeOf: () => Promise.resolve(MAX_PICKED_BYTES) },
    );
    expect(await readPicked('/a.rpr', deps, 'files.read-failed')).toEqual(ok('text'));
  });

  it("says it couldn't read a file that is gone, logged", async () => {
    const { deps, events } = disk();
    expect(await readPicked('/gone.rpr', deps, 'files.read-failed')).toEqual(
      err({ kind: 'read-failed' }),
    );
    expect(events()).toEqual(['files.read-failed']);
  });

  it('writes beside the file first, then puts it in place', async () => {
    const { deps, files } = disk({ '/a.rpr': 'old' });
    expect(await writePicked('/a.rpr', 'new', deps, 'files.write-failed')).toEqual(ok(undefined));
    expect(files).toEqual({ '/a.rpr': 'new' });
  });

  it('a write that fails leaves the old file whole and no temporary file', async () => {
    const { deps, files, events } = disk(
      { '/a.rpr': 'old' },
      { rename: () => Promise.reject(new Error('EACCES')) },
    );
    expect(await writePicked('/a.rpr', 'new', deps, 'files.write-failed')).toEqual(
      err({ kind: 'write-failed' }),
    );
    expect(files).toEqual({ '/a.rpr': 'old' });
    expect(events()).toEqual(['files.write-failed']);
  });

  it('logs a temporary file it could not remove, and still says the write failed', async () => {
    const { deps, events } = disk(
      {},
      {
        writeText: () => Promise.reject(new Error('ENOSPC')),
        remove: () => Promise.reject(new Error('EBUSY')),
      },
    );
    expect(await writePicked('/a.rpr', 'new', deps, 'files.write-failed')).toEqual(
      err({ kind: 'write-failed' }),
    );
    expect(events()).toEqual(['files.write-failed', 'files.temp-not-removed']);
  });
});
