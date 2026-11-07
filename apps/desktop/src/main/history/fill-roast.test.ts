import { createLogger } from '@roastpilot/core';
import { err, ok, type LogEntry, type Result, type StorageError } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { fillOrRemove, type RoastToFill } from './fill-roast';

const ROAST: RoastToFill = {
  samples: [],
  events: [{ kind: 'charge', tS: 0, bt: 200 }],
  endedAt: null,
  fcTimeS: null,
  dropTimeS: null,
  dropTemp: null,
  batchG: null,
  roastedG: null,
  notes: null,
};

const FAILED = err({ kind: 'storage-failed' as const, message: 'disk full' });

type Written = Result<void, StorageError>;

function setup({
  addEvent = ok(undefined),
  remove = ok(undefined),
}: { addEvent?: Written; remove?: Written } = {}) {
  const entries: LogEntry[] = [];
  const repository = {
    addSamples: vi.fn(() => Promise.resolve(ok(undefined))),
    addEvent: vi.fn(() => Promise.resolve(addEvent)),
    update: vi.fn(() => Promise.resolve(ok(undefined))),
    saveResult: vi.fn(() => Promise.resolve(ok(undefined))),
    delete: vi.fn(() => Promise.resolve(remove)),
  };
  const logger = createLogger({ write: (e) => entries.push(e) }, 'history');
  return { repository, entries, logger };
}

describe('fillOrRemove', () => {
  it('keeps a roast that was written whole', async () => {
    const { repository, logger } = setup();
    expect(await fillOrRemove(repository, 7, ROAST, logger)).toEqual(ok(undefined));
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes the half-written roast and returns why it failed', async () => {
    const { repository, entries, logger } = setup({ addEvent: FAILED });
    expect(await fillOrRemove(repository, 7, ROAST, logger)).toEqual(FAILED);
    expect(repository.delete).toHaveBeenCalledWith(7);
    expect(entries).toEqual([]);
  });

  it('logs a delete that fails too, and still returns the first failure', async () => {
    const { repository, entries, logger } = setup({
      addEvent: FAILED,
      remove: err({ kind: 'storage-failed' as const, message: 'locked' }),
    });
    expect(await fillOrRemove(repository, 7, ROAST, logger)).toEqual(FAILED);
    expect(entries.map((e) => [e.event, e.context?.id])).toEqual([
      ['history.import-cleanup-failed', 7],
    ]);
  });
});
