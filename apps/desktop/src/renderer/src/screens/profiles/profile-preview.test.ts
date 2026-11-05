import { describe, expect, it } from 'vitest';
import { CURVE, STEPS } from '../../test/profiles';
import { profilePreview, timeAtC } from './profile-preview';

const layer = (preview: ReturnType<typeof profilePreview>, id: string) =>
  preview.layers.find((l) => l.id === id);

describe('timeAtC', () => {
  const curve = [
    { tS: 0, c: 180 },
    { tS: 60, c: 90 },
    { tS: 160, c: 190 },
  ];
  it('finds the climb, not the fall after charge', () => {
    expect(timeAtC(curve, 150)).toBe(120);
  });
  it('is undefined for a temperature never reached', () => {
    expect(timeAtC(curve, 195)).toBeUndefined();
  });
});

describe('profilePreview', () => {
  it('draws a step profile from its steps, with the soak you set', () => {
    const preview = profilePreview(STEPS, 60);
    expect(layer(preview, 'heater')?.points).toEqual([
      { t: 0, v: 0 },
      { t: 60, v: 85 },
      { t: 305, v: 40 },
      { t: 489, v: 40 },
    ]);
    expect(layer(preview, 'fan')?.points.map((p) => p.v)).toEqual([30, 30, 80, 80]);
    expect(preview.markers.map((m) => [m.id, m.t])).toEqual([
      ['dry-end', 305],
      ['drop', 489],
    ]);
  });

  it('moves everything with a longer soak', () => {
    const preview = profilePreview(STEPS, 90);
    expect(layer(preview, 'heater')?.points[1]).toEqual({ t: 90, v: 85 });
  });

  it('draws a curve profile from its points, a step ending where the curve reaches it', () => {
    const preview = profilePreview(CURVE, 60);
    expect(layer(preview, 'plan')?.dash).toEqual([6, 6]);
    expect(layer(preview, 'plan')?.points.at(-1)).toEqual({ t: 600, v: 197 });
    expect(layer(preview, 'heater')?.points[2]).toEqual({ t: 305, v: 40 });
  });
});
