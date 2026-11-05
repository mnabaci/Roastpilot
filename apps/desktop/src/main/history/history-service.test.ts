import { createLogger } from '@roastpilot/core';
import { err, ok, type LogEntry, type RoastSummary } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { HistoryService } from './history-service';
import { unavailableRepository } from './unavailable-repository';

const ROAST: RoastSummary = {
  id: 1,
  startedAt: '2026-11-04T10:00:00.000Z',
  endedAt: null,
  fcTimeS: null,
  dropTimeS: null,
  dropTemp: null,
  roasterId: null,
};

function setup(repository = unavailableRepository('disk gone')) {
  const entries: LogEntry[] = [];
  const onDeleted = vi.fn();
  const service = new HistoryService({
    repository,
    isRecording: (id) => id === 9,
    onDeleted,
    logger: createLogger({ write: (e) => entries.push(e) }, 'history'),
  });
  return { service, entries, onDeleted };
}

describe('HistoryService', () => {
  it('lists roasts', async () => {
    const { service } = setup({
      ...unavailableRepository('x'),
      list: () => Promise.resolve(ok([ROAST])),
    });
    expect(await service.list()).toEqual([ROAST]);
  });

  it('an unreadable database lists nothing and logs why', async () => {
    const { service, entries } = setup();
    expect(await service.list()).toEqual([]);
    expect(entries.at(-1)).toMatchObject({
      event: 'history.list-failed',
      context: { error: { kind: 'storage-failed', message: 'disk gone' } },
    });
  });

  it('a failed get is returned and logged', async () => {
    const { service, entries } = setup();
    expect(await service.get(1)).toMatchObject({ ok: false });
    expect(entries.at(-1)?.event).toBe('history.get-failed');
  });

  it('delete tells the windows only when it worked', async () => {
    const { service, onDeleted } = setup({
      ...unavailableRepository('x'),
      delete: (id) =>
        Promise.resolve(id === 1 ? ok(undefined) : err({ kind: 'not-found' as const, id })),
    });
    expect(await service.delete(2)).toMatchObject({ ok: false });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(await service.delete(1)).toEqual(ok(undefined));
    expect(onDeleted).toHaveBeenCalledWith(1);
  });

  it('refuses to delete the roast being saved, and logs it', async () => {
    const { service, entries, onDeleted } = setup();
    expect(await service.delete(9)).toEqual(err({ kind: 'in-progress', id: 9 }));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(entries.at(-1)?.event).toBe('history.delete-refused');
  });
});
