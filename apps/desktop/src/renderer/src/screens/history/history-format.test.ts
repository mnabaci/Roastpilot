import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import {
  inProgressId,
  roastNumbers,
  roastRows,
  roastTitle,
  selectionAfterDelete,
} from './history-format';

const UTC_GB = { locale: 'en-GB', timeZone: 'UTC' };
const summary = (id: number, over: Partial<RoastSummary> = {}): RoastSummary => ({
  id,
  startedAt: '2026-11-04T14:32:10.000Z',
  endedAt: '2026-11-04T14:46:00.000Z',
  fcTimeS: 480,
  fcTemp: null,
  dropTimeS: 580,
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
  dropTemp: 205.5,
  ...over,
});

describe('history formatting', () => {
  it('titles a roast by its local day and time', () => {
    expect(roastTitle('2026-11-04T14:32:10.000Z', UTC_GB)).toBe('Wed 4 Nov · 14:32');
    expect(roastTitle('2026-11-04T09:05:00.000Z', UTC_GB)).toBe('Wed 4 Nov · 09:05');
  });

  it('says so for a date that does not parse', () => {
    expect(roastTitle('not a date')).toBe('Unknown date');
  });

  it('numbers: total, first crack, drop temp, leaving out what is missing', () => {
    expect(roastNumbers(summary(1))).toBe('9:40 · FC 8:00 · 205.5 °C');
    expect(roastNumbers(summary(1, { fcTimeS: null }))).toBe('9:40 · 205.5 °C');
    expect(roastNumbers(summary(1, { fcTimeS: null, dropTimeS: null, dropTemp: null }))).toBe('');
  });

  it('marks unfinished roasts, and the newest as In progress while roasting', () => {
    const roasts = [summary(2, { endedAt: null }), summary(1, { endedAt: null })];
    expect(roastRows(roasts, 'done', UTC_GB).map((r) => r.badge)).toEqual([
      'Unfinished',
      'Unfinished',
    ]);
    expect(roastRows(roasts, 'cooling', UTC_GB).map((r) => r.badge)).toEqual([
      'In progress',
      'Unfinished',
    ]);
    expect(roastRows([summary(3)], 'roasting', UTC_GB)[0]?.badge).toBeUndefined();
  });

  it('after a delete, selects the next roast down, else the one above', () => {
    const roasts = [summary(3), summary(2), summary(1)];
    expect(selectionAfterDelete(roasts, 2)).toBe(1);
    expect(selectionAfterDelete(roasts, 1)).toBe(2);
    expect(selectionAfterDelete([summary(1)], 1)).toBeUndefined();
    expect(selectionAfterDelete(roasts, 99)).toBe(3);
  });

  it('only the newest unended roast is in progress, and only while roasting', () => {
    const roasts = [summary(2, { endedAt: null }), summary(1, { endedAt: null })];
    expect(inProgressId(roasts, 'development')).toBe(2);
    expect(inProgressId(roasts, 'done')).toBeUndefined();
    expect(inProgressId([summary(3), ...roasts], 'roasting')).toBeUndefined();
  });
});
