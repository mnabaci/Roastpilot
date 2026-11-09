import type { RoastDetail } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { compareRows } from './compare-rows';

const roast = (over: Partial<RoastDetail> = {}): RoastDetail => ({
  id: 1,
  mode: 'auto',
  profile: null,
  roasterId: null,
  beanId: 3,
  ghostRoastId: null,
  batchG: 356,
  roastedG: 305,
  rating: 5,
  isFavourite: false,
  notes: null,
  profileId: 'light-steps',
  profileName: 'Light · Steps',
  imported: false,
  startedAt: '2026-11-04T14:32:00.000Z',
  endedAt: '2026-11-04T14:50:00.000Z',
  fcTimeS: 480,
  fcTemp: 196.2,
  dropTimeS: 594,
  dropTemp: 205.5,
  samples: [],
  events: [
    { kind: 'charge', tS: 0, bt: 180 },
    { kind: 'turning-point', tS: 92, bt: 92.4 },
    { kind: 'dry-end', tS: 270, bt: 150 },
    { kind: 'first-crack', tS: 480, bt: 196.2 },
    { kind: 'drop', tS: 594, bt: 205.5 },
  ],
  ...over,
});

const OTHER = roast({
  id: 2,
  beanId: 4,
  batchG: 350,
  roastedG: 304,
  rating: 4,
  profileId: null,
  profileName: null,
  fcTimeS: 450,
  fcTemp: 195,
  dropTimeS: 540,
  dropTemp: 206.5,
  events: [
    { kind: 'charge', tS: 0, bt: 180 },
    { kind: 'turning-point', tS: 87, bt: 93.4 },
    { kind: 'first-crack', tS: 450, bt: 195 },
    { kind: 'drop', tS: 540, bt: 206.5 },
  ],
});
const BEANS = [
  { id: 3, name: 'African Moon' },
  { id: 4, name: 'Ethiopia Guji' },
];

describe('compareRows', () => {
  it('puts each number of both roasts side by side with this roast minus the other', () => {
    expect(compareRows(roast(), OTHER, 'c', BEANS)).toEqual([
      { label: 'Total', own: '9:54', other: '9:00', diff: '+0:54' },
      {
        label: 'Turning point',
        own: '1:32 · 92.4 °C',
        other: '1:27 · 93.4 °C',
        diff: '+0:05 · −1.0 °C',
      },
      { label: 'Dry end', own: '4:30 · 150.0 °C', other: undefined, diff: undefined },
      {
        label: 'First crack',
        own: '8:00 · 196.2 °C',
        other: '7:30 · 195.0 °C',
        diff: '+0:30 · +1.2 °C',
      },
      { label: 'Development', own: '1:54 · 19 %', other: '1:30 · 17 %', diff: '+0:24 · +2 %' },
      { label: 'Drop temp', own: '205.5 °C', other: '206.5 °C', diff: '−1.0 °C' },
      { label: 'Weight loss', own: '14.3 %', other: '13.1 %', diff: '+1.2 %' },
      { label: 'Rating', own: '5/5', other: '4/5', diff: '+1' },
      { label: 'Profile', own: 'Auto · Light · Steps', other: 'Manual', diff: undefined },
      { label: 'Bean', own: 'African Moon', other: 'Ethiopia Guji', diff: undefined },
    ]);
  });

  it('in °F shows temperatures whole, and a difference ×1.8 with no + 32', () => {
    const rows = compareRows(roast(), OTHER, 'f', BEANS);
    expect(rows.find((r) => r.label === 'Drop temp')).toEqual({
      label: 'Drop temp',
      own: '402 °F',
      other: '404 °F',
      diff: '−2 °F',
    });
    expect(rows.find((r) => r.label === 'Turning point')?.diff).toBe('+0:05 · −2 °F');
  });

  it('says a same value as no difference, and a shorter roast with a real minus', () => {
    const rows = compareRows(OTHER, roast(), 'c', BEANS);
    expect(rows.find((r) => r.label === 'Total')?.diff).toBe('−0:54');
    const same = compareRows(roast(), roast({ id: 2 }), 'c', BEANS);
    expect(same.find((r) => r.label === 'Total')?.diff).toBe('0:00');
    expect(same.find((r) => r.label === 'Drop temp')?.diff).toBe('0.0 °C');
    expect(same.find((r) => r.label === 'Rating')?.diff).toBe('0');
  });

  it('leaves the difference blank where either side is missing a value', () => {
    const bare = roast({
      fcTimeS: null,
      fcTemp: null,
      dropTimeS: null,
      dropTemp: null,
      roastedG: null,
      rating: null,
      beanId: null,
      events: [{ kind: 'charge', tS: 0, bt: 180 }],
    });
    const rows = compareRows(bare, OTHER, 'c', BEANS);
    for (const label of [
      'Total',
      'First crack',
      'Development',
      'Drop temp',
      'Weight loss',
      'Rating',
    ])
      expect(rows.find((r) => r.label === label)).toMatchObject({
        own: undefined,
        diff: undefined,
      });
    expect(rows.find((r) => r.label === 'Bean')?.own).toBe('No bean');
  });

  it('gives only the time difference when one side has no temperature at the event', () => {
    const noTemp = roast({
      events: [
        { kind: 'charge', tS: 0, bt: 180 },
        { kind: 'turning-point', tS: 92, bt: null },
      ],
    });
    expect(compareRows(noTemp, OTHER, 'c', BEANS).find((r) => r.label === 'Turning point')).toEqual(
      { label: 'Turning point', own: '1:32', other: '1:27 · 93.4 °C', diff: '+0:05' },
    );
  });

  it('takes each difference from the values as shown, so the row adds up', () => {
    const a = roast({ dropTimeS: 185.9, dropTemp: 86.2 });
    const b = roast({ id: 2, dropTimeS: 255.0, dropTemp: 61.4 });
    const rows = compareRows(a, b, 'f', BEANS);
    // 3:05 against 4:15, never the raw −1:09.1 rounded to −1:09.
    expect(rows.find((r) => r.label === 'Total')).toMatchObject({
      own: '3:05',
      other: '4:15',
      diff: '−1:10',
    });
    // 187 °F against 143 °F.
    expect(rows.find((r) => r.label === 'Drop temp')).toMatchObject({
      own: '187 °F',
      other: '143 °F',
      diff: '+44 °F',
    });
  });
});
