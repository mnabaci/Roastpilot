import { ROAST_FILE_VERSION, type RoastDetail } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { idByName, parseRoastFile, toRoastFile } from './roast-file';

const ROAST: RoastDetail = {
  id: 7,
  startedAt: '2026-11-04T10:00:00.000Z',
  endedAt: '2026-11-04T10:14:00.000Z',
  fcTimeS: 480,
  fcTemp: 196,
  dropTimeS: 580,
  dropTemp: 205.5,
  roasterId: 1,
  beanId: 3,
  ghostRoastId: 2,
  batchG: 375,
  roastedG: 320,
  rating: 4,
  isFavourite: true,
  notes: 'Bright',
  profileId: null,
  profileName: null,
  imported: false,
  mode: 'manual',
  profile: null,
  samples: [{ tS: 0, values: { bt: 180 } }],
  events: [{ kind: 'charge', tS: 0, bt: 180 }],
};
const NAMES = { beans: new Map([[3, 'Ethiopia Guji']]), roasters: new Map([[1, 'Skywalker']]) };

describe('Roastpilot roast file', () => {
  it('carries each roast in full, by names instead of ids', () => {
    const file = toRoastFile([ROAST], NAMES, new Date('2026-11-06T12:00:00.000Z'));
    expect(file).toMatchObject({
      format: 'roastpilot-roasts',
      version: ROAST_FILE_VERSION,
      exportedAt: '2026-11-06T12:00:00.000Z',
    });
    const [roast] = file.roasts;
    expect(roast).toMatchObject({ beanName: 'Ethiopia Guji', roasterName: 'Skywalker', rating: 4 });
    expect(roast).not.toHaveProperty('id');
    expect(roast).not.toHaveProperty('beanId');
    expect(roast).not.toHaveProperty('ghostRoastId');
    // Read from the events, so the file stays as it was.
    expect(roast).not.toHaveProperty('fcTemp');
    // Version 2: samples as columns.
    expect(roast?.samples).toEqual({ tS: [0], values: { bt: [180] } });
  });

  it('still reads a version 1 file, samples as rows', () => {
    const { roasts, ...head } = toRoastFile([ROAST], NAMES, new Date());
    const v1 = {
      ...head,
      version: 1,
      roasts: roasts.map((r) => ({ ...r, samples: ROAST.samples })),
    };
    const parsed = parseRoastFile(JSON.stringify(v1));
    expect(parsed.ok && parsed.value[0]?.samples).toEqual(ROAST.samples);
  });

  it('refuses version 2 columns of different lengths', () => {
    const file = toRoastFile([ROAST], NAMES, new Date());
    const [first] = file.roasts;
    if (!first) throw new Error('no roast');
    const broken = {
      ...file,
      roasts: [{ ...first, samples: { tS: [0, 1], values: { bt: [180] } } }],
    };
    expect(parseRoastFile(JSON.stringify(broken))).toEqual({ ok: false, error: 'not-roastpilot' });
  });

  it('reads back what it wrote', () => {
    const text = JSON.stringify(toRoastFile([ROAST], NAMES, new Date()));
    const parsed = parseRoastFile(text);
    expect(parsed.ok && parsed.value[0]?.notes).toBe('Bright');
  });

  it.each([
    ['not JSON', 'nope'],
    ['another JSON file', '{"name":"package"}'],
    [
      'a roast with a bad field',
      JSON.stringify({
        format: 'roastpilot-roasts',
        version: 1,
        exportedAt: '',
        roasts: [{ startedAt: 1 }],
      }),
    ],
  ])('refuses %s', (_, text) => {
    expect(parseRoastFile(text)).toEqual({ ok: false, error: 'not-roastpilot' });
  });

  it('refuses a file from a newer Roastpilot', () => {
    const text = JSON.stringify({ format: 'roastpilot-roasts', version: 99, roasts: [] });
    expect(parseRoastFile(text)).toEqual({ ok: false, error: 'newer-version' });
  });

  it('matches names exactly', () => {
    expect(idByName(NAMES.beans, 'Ethiopia Guji')).toBe(3);
    expect(idByName(NAMES.beans, 'ethiopia guji')).toBeNull();
    expect(idByName(NAMES.beans, null)).toBeNull();
  });
});
