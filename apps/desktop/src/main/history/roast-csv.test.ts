import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { roastsToCsv } from './roast-csv';

const ROAST: RoastSummary = {
  id: 7,
  startedAt: '2026-11-04T10:00:00.000Z',
  endedAt: null,
  fcTimeS: 480,
  dropTimeS: 570.5,
  dropTemp: 205,
  roasterId: 1,
  beanId: 4,
  ghostRoastId: null,
  batchG: 400,
  roastedG: null,
  rating: 5,
  isFavourite: true,
  notes: 'Sweet, "floral"\nnext time less fan',
  profileId: 'p',
  profileName: 'Light · Curve',
};

describe('roastsToCsv', () => {
  it('writes a header and quotes what needs it', () => {
    const [header, ...rest] = roastsToCsv([ROAST], new Map([[4, 'Çay, Yirga']]))
      .replace('\uFEFF', '')
      .split('\r\n');
    expect(header?.startsWith('id,started_at,ended_at,bean,profile')).toBe(true);
    expect(rest[0]).toBe(
      '7,2026-11-04T10:00:00.000Z,,"Çay, Yirga",Light · Curve,400,,480,570.5,205,5,yes,"Sweet, ""floral""\nnext time less fan"',
    );
  });

  it('starts with a byte order mark and leaves unknown beans empty', () => {
    const csv = roastsToCsv([{ ...ROAST, beanId: 99, notes: null }], new Map());
    expect(csv.startsWith('\uFEFFid,')).toBe(true);
    expect(csv).toContain('.000Z,,,Light');
  });

  it.each(['=HYPERLINK("x")', '+1', '-1', '@cmd'])('stops %s running as a formula', (notes) => {
    const csv = roastsToCsv([{ ...ROAST, notes }], new Map());
    expect(csv).toMatch(/,yes,"?'/);
  });
});
