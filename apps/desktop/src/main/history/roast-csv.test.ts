import type { RoastSummary } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { roastsToCsv } from './roast-csv';

const ROAST: RoastSummary = {
  id: 7,
  startedAt: '2026-11-04T10:00:00.000Z',
  endedAt: null,
  fcTimeS: 480,
  fcTemp: 196,
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
  imported: false,
};

describe('roastsToCsv', () => {
  it('writes a header and quotes what needs it', () => {
    const [header, ...rest] = roastsToCsv([ROAST], new Map([[4, 'Çay, Yirga']]), 'c')
      .replace('\uFEFF', '')
      .split('\r\n');
    expect(header?.startsWith('id,started_at,ended_at,bean,profile')).toBe(true);
    expect(rest[0]).toBe(
      '7,2026-11-04T10:00:00.000Z,,"Çay, Yirga",Light · Curve,400,,480,570.5,205,5,yes,"Sweet, ""floral""\nnext time less fan"',
    );
  });

  it('names the drop temperature column by its unit: drop_c, or drop_f in °F', () => {
    const header = (csv: string) => csv.replace('\uFEFF', '').split('\r\n')[0]?.split(',');
    expect(header(roastsToCsv([ROAST], new Map(), 'c'))).toContain('drop_c');
    const inF = roastsToCsv([{ ...ROAST, dropTemp: 205.5 }], new Map(), 'f');
    expect(header(inF)).toContain('drop_f');
    expect(header(inF)).not.toContain('drop_c');
    // 205.5 °C is 401.9 °F; times and weights stay as they are.
    expect(inF).toContain(',400,,480,570.5,401.9,5,');
  });

  it('starts with a byte order mark and leaves unknown beans empty', () => {
    const csv = roastsToCsv([{ ...ROAST, beanId: 99, notes: null }], new Map(), 'c');
    expect(csv.startsWith('\uFEFFid,')).toBe(true);
    expect(csv).toContain('.000Z,,,Light');
  });

  it.each(['=HYPERLINK("x")', '+1', '-1', '@cmd'])('stops %s running as a formula', (notes) => {
    const csv = roastsToCsv([{ ...ROAST, notes }], new Map(), 'c');
    expect(csv).toMatch(/,yes,"?'/);
  });
});
