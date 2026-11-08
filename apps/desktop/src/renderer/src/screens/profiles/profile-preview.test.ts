import { describe, expect, it } from 'vitest';
import { CURVE, STEPS } from '../../test/profiles';
import { profilePreview } from './profile-preview';

const layer = (preview: ReturnType<typeof profilePreview>, id: string) =>
  preview.layers.find((l) => l.id === id);

describe('profilePreview', () => {
  it('draws a step profile from its steps, after its soak', () => {
    const preview = profilePreview(STEPS);
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
    const [soak, ...rest] = STEPS.phases;
    if (!soak) throw new Error('no soak');
    const longer = { ...soak, next: { on: 'time', afterS: 90 } } as const;
    const preview = profilePreview({ ...STEPS, phases: [longer, ...rest] });
    expect(layer(preview, 'heater')?.points[1]).toEqual({ t: 90, v: 85 });
  });

  it('without a soak, heats from charge', () => {
    const preview = profilePreview({ ...STEPS, phases: STEPS.phases.slice(1) });
    expect(layer(preview, 'heater')?.points.slice(0, 2)).toEqual([
      { t: 0, v: 85 },
      { t: 245, v: 40 },
    ]);
    expect(layer(preview, 'fan')?.points[0]).toEqual({ t: 0, v: 30 });
  });

  it('draws a curve profile from its points, a step ending where the curve reaches it', () => {
    const preview = profilePreview(CURVE);
    expect(layer(preview, 'plan')?.dash).toEqual([6, 6]);
    expect(layer(preview, 'plan')?.points.at(-1)).toEqual({ t: 600, v: 197 });
    expect(layer(preview, 'heater')?.points[2]).toEqual({ t: 305, v: 40 });
  });
});
