import type { RoastDetail } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { savedAsLive, savedRoastChart, savedRoastFocus } from './saved-roast-chart';

const DETAIL: RoastDetail = {
  id: 1,
  mode: 'manual',
  profile: null,
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
  startedAt: '2026-11-04T14:32:10.000Z',
  endedAt: '2026-11-04T14:46:00.000Z',
  fcTimeS: 2,
  fcTemp: null,
  dropTimeS: 3,
  dropTemp: 205,
  samples: [
    { tS: -1, values: { bt: 170, heater: 50, fan: 30 } },
    { tS: 0, values: { bt: 180, heater: 50, fan: 30 } },
    { tS: 1, values: { bt: 182, heater: 60, fan: 30 } },
    { tS: 2, values: { bt: 190, heater: 60, fan: 40 } },
    { tS: 3, values: { bt: 205, heater: 0, fan: 100 } },
  ],
  events: [
    { kind: 'charge', tS: 0, bt: 180 },
    { kind: 'first-crack', tS: 2, bt: 190 },
    { kind: 'drop', tS: 3, bt: 205 },
  ],
};

describe('saved roast chart', () => {
  it('turns a saved roast into the live shape, charge at 0', () => {
    const { roast, readings } = savedAsLive(DETAIL);
    expect(roast).toMatchObject({
      phase: 'done',
      preheatAtMs: -1000,
      chargedAtMs: 0,
      firstCrackAtMs: 2000,
      droppedAtMs: 3000,
    });
    expect(readings[0]).toEqual({ atMs: -1000, values: { bt: 170, heater: 50, fan: 30 } });
  });

  it('draws the roast with its markers, in seconds from charge', () => {
    const chart = savedRoastChart(DETAIL, undefined, 0);
    expect(chart.layers.map((l) => l.id)).toEqual(['bt', 'ror', 'heater', 'fan']);
    expect(chart.layers[0]?.points[0]).toEqual({ t: -1, v: 170 });
    expect(chart.markers.map((m) => [m.label, m.t])).toEqual([
      ['Charge', 0],
      ['First crack', 2],
      ['Drop', 3],
    ]);
  });

  it('puts the compared roast behind, as a faded temperature line', () => {
    const other = {
      ...DETAIL,
      id: 2,
      samples: DETAIL.samples.map((s) => ({ ...s, values: { bt: 100 } })),
    };
    const chart = savedRoastChart(DETAIL, { detail: other, label: 'Mon 2 Nov · 18:20' }, 0);
    expect(chart.layers[0]).toMatchObject({
      id: 'compare-bt',
      label: 'Mon 2 Nov · 18:20',
      tone: 'ghost',
      width: 2,
    });
    expect(chart.layers[0]?.points[0]).toEqual({ t: -1, v: 100 });
    expect(chart.layers[1]?.id).toBe('bt');
  });
});

describe('savedRoastFocus', () => {
  const roast = (over: Partial<RoastDetail>): RoastDetail => ({
    ...DETAIL,
    dropTimeS: 660,
    samples: [
      { tS: -420, values: { bt: 150 } },
      { tS: 0, values: { bt: 180 } },
      { tS: 660, values: { bt: 199 } },
      { tS: 900, values: { bt: 60 } },
    ],
    events: [
      { kind: 'charge', tS: 0, bt: 180 },
      { kind: 'drop', tS: 660, bt: 199 },
      { kind: 'cool-end', tS: 900, bt: 60 },
    ],
    ...over,
  });

  it('runs from −0:30 to the cool end + 0:30', () => {
    expect(savedRoastFocus(roast({}))).toEqual({ fromS: -30, toS: 930 });
  });

  it('runs to Stop roast + 0:30 when the roast was ended there', () => {
    const ended = roast({
      events: [
        { kind: 'charge', tS: 0, bt: 180 },
        { kind: 'drop', tS: 660, bt: 199 },
        { kind: 'end', tS: 700, bt: 150 },
      ],
    });
    expect(savedRoastFocus(ended)).toEqual({ fromS: -30, toS: 730 });
  });

  it('runs to drop + 0:30 when cooling never ended', () => {
    const unfinished = roast({ events: [{ kind: 'drop', tS: 660, bt: 199 }] });
    expect(savedRoastFocus(unfinished)).toEqual({ fromS: -30, toS: 690 });
  });

  it('reaches the end of a longer compared roast, so its crack and drop stay in view', () => {
    const short = roast({
      dropTimeS: 480,
      events: [{ kind: 'drop', tS: 480, bt: 199 }],
      samples: [
        { tS: -420, values: { bt: 150 } },
        { tS: 480, values: { bt: 199 } },
      ],
    });
    // The compared roast cools until 15:00.
    expect(savedRoastFocus(short, roast({}))).toEqual({ fromS: -30, toS: 930 });
    // A shorter compared roast changes nothing.
    expect(savedRoastFocus(roast({}), short)).toEqual({ fromS: -30, toS: 930 });
  });

  it("offers Show preheat for the compared roast's preheat alone", () => {
    const noPreheat = roast({ samples: [{ tS: 0, values: { bt: 180 } }] });
    expect(savedRoastFocus(noPreheat, roast({}))).toEqual({ fromS: -30, toS: 930 });
  });

  it('is none when it would hide nothing, so there is no Show preheat', () => {
    const noPreheat = roast({ samples: [{ tS: 0, values: { bt: 180 } }] });
    expect(savedRoastFocus(noPreheat)).toBeUndefined();
    expect(savedRoastFocus(roast({ dropTimeS: null, events: [] }))).toBeUndefined();
  });
});
