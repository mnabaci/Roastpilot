import type { RoastDetail, SavedSample } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { formatGhostDelta, ghostChart, ghostDelta } from './ghost';

/** Dips to 100 at 60 s, then climbs 0.2 °C/s. */
const SAMPLES: SavedSample[] = Array.from({ length: 301 }, (_, i) => {
  const tS = i * 2;
  return { tS, values: { bt: tS < 60 ? 180 - (tS / 60) * 80 : 100 + (tS - 60) * 0.2 } };
});

const DETAIL = {
  endedAt: 'x',
  samples: [{ tS: -30, values: { bt: 170 } }, ...SAMPLES],
  events: [
    { kind: 'charge', tS: 0, bt: 180 },
    { kind: 'first-crack', tS: 400, bt: 168 },
    { kind: 'drop', tS: 500, bt: 188 },
  ],
} as unknown as RoastDetail;

describe('ghostChart', () => {
  it('fades temperature and RoR, from charge on', () => {
    const { layers } = ghostChart(DETAIL, 0);
    expect(layers.map((l) => [l.id, l.tone])).toEqual([
      ['ghost-bt', 'ghost'],
      ['ghost-ror', 'ghost'],
    ]);
    expect(layers.every((l) => l.points.every((p) => p.t >= 0))).toBe(true);
  });

  it('adds faded markers for the ghost first crack and drop only', () => {
    expect(ghostChart(DETAIL, 0).markers).toEqual([
      { id: 'ghost-first-crack', label: 'Ghost FC', t: 400, tone: 'ghost' },
      { id: 'ghost-drop', label: 'Ghost drop', t: 500, tone: 'ghost' },
    ]);
  });
});

describe('ghostDelta', () => {
  it('compares temperature at this time, and time at this temperature', () => {
    // The ghost is at 140 °C at 260 s.
    const delta = ghostDelta(SAMPLES, null, 260, 143);
    expect(delta?.deltaC).toBeCloseTo(3);
    expect(delta?.aheadS).toBeCloseTo(15);
  });

  it('reads behind when today is cooler, past the dip', () => {
    expect(ghostDelta(SAMPLES, null, 260, 136)?.aheadS).toBeCloseTo(-20);
  });

  it('leaves cooling out, so the time still reads and nothing shows past the drop', () => {
    const cooling = [...SAMPLES, { tS: 700, values: { bt: 60 } }, { tS: 800, values: { bt: 40 } }];
    expect(ghostDelta(cooling, 600, 260, 143)?.aheadS).toBeCloseTo(15);
    expect(ghostDelta(cooling, 600, 640, 210)).toBeUndefined();
  });

  it('has no time when the ghost never got there, and nothing past its end', () => {
    expect(ghostDelta(SAMPLES, null, 260, 500)?.aheadS).toBeUndefined();
    expect(ghostDelta(SAMPLES, null, 9999, 150)).toBeUndefined();
  });
});

describe('formatGhostDelta', () => {
  it('signs and words it', () => {
    expect(formatGhostDelta({ deltaC: 3.2, aheadS: 12 })).toBe('+3 °C vs ghost · 0:12 ahead');
    expect(formatGhostDelta({ deltaC: -1.6, aheadS: -75 })).toBe('-2 °C vs ghost · 1:15 behind');
    expect(formatGhostDelta({ deltaC: 0, aheadS: 0.2 })).toBe('0 °C vs ghost · level');
    expect(formatGhostDelta({ deltaC: 5, aheadS: undefined })).toBe('+5 °C vs ghost');
  });
});
