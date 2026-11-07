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
  fcTemp: null,
  dropTimeS: null,
  dropTemp: null,
  roasterId: null,
  beanId: null,
  ghostRoastId: null,
  batchG: null,
  roastedG: null,
  rating: null,
  isFavourite: false,
  notes: null,
  profileId: null,
  profileName: null,
  imported: false,
};

function setup(repository = unavailableRepository('disk gone')) {
  const entries: LogEntry[] = [];
  const onDeleted = vi.fn();
  const onResultSaved = vi.fn();
  const service = new HistoryService({
    repository,
    beanNames: () => Promise.resolve(new Map([[4, 'Yirgacheffe']])),
    isRecording: (id) => id === 9,
    onDeleted,
    onResultSaved,
    logger: createLogger({ write: (e) => entries.push(e) }, 'history'),
  });
  return { service, entries, onDeleted, onResultSaved };
}

describe('HistoryService', () => {
  const RESULT = {
    id: 1,
    batchG: 375,
    roastedG: 320,
    rating: 4,
    isFavourite: true,
    notes: null,
  };

  it('says when a roast result is saved', async () => {
    const repository = {
      ...unavailableRepository('x'),
      saveResult: () => Promise.resolve(ok(undefined)),
    };
    const { service, onResultSaved } = setup(repository);
    expect(await service.saveResult(RESULT)).toEqual(ok(undefined));
    expect(onResultSaved).toHaveBeenCalledWith(1);
  });

  it('a failed result stays quiet and is logged', async () => {
    const { service, onResultSaved, entries } = setup();
    expect((await service.saveResult(RESULT)).ok).toBe(false);
    expect(onResultSaved).not.toHaveBeenCalled();
    expect(entries.map((e) => e.event)).toContain('history.result-failed');
  });

  it('links a roast to a bean and says so; a failure is logged', async () => {
    const setBean = vi.fn(() => Promise.resolve(ok(undefined)));
    const { service, onResultSaved } = setup({ ...unavailableRepository('x'), setBean });
    expect(await service.setBean(1, 3)).toEqual(ok(undefined));
    expect(setBean).toHaveBeenCalledWith(1, 3);
    expect(onResultSaved).toHaveBeenCalledWith(1);
    const failing = setup();
    expect((await failing.service.setBean(1, 3)).ok).toBe(false);
    expect(failing.entries.map((e) => e.event)).toContain('history.set-bean-failed');
  });

  it('exports only the roasts named as CSV', async () => {
    const other = { ...ROAST, id: 2, startedAt: '2026-11-05T10:00:00.000Z' };
    const { service } = setup({
      ...unavailableRepository('x'),
      list: () => Promise.resolve(ok([ROAST, other])),
    });
    const csv = await service.exportCsv([2]);
    const lines = csv.ok ? csv.value.trim().split('\n') : [];
    expect(lines).toHaveLength(2);
  });

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
