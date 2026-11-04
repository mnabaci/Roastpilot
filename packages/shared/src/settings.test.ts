import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema } from './settings';

describe('SettingsSchema', () => {
  it('defaults to Guided and no roaster', () => {
    expect(DEFAULT_SETTINGS).toEqual({ connection: null, controls: 'guided', chartSmoothingS: 3 });
  });

  it('keeps valid settings', () => {
    const settings = {
      connection: { kind: 'serial', path: 'COM3' },
      controls: 'full',
      chartSmoothingS: 10,
    };
    expect(SettingsSchema.parse(settings)).toEqual(settings);
  });

  it('falls back field by field, so one bad value does not lose the rest', () => {
    expect(SettingsSchema.parse({ connection: { kind: 'wifi' }, controls: 'full' })).toEqual({
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
    });
    expect(SettingsSchema.parse({ connection: { kind: 'simulator' }, controls: 'expert' })).toEqual(
      {
        connection: { kind: 'simulator' },
        controls: 'guided',
        chartSmoothingS: 3,
      },
    );
  });

  it('ignores fields it does not know', () => {
    expect(SettingsSchema.parse({ controls: 'full', theme: 'neon' })).toEqual({
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
    });
  });

  it('turns an unknown smoothing into the 3 s default', () => {
    expect(SettingsSchema.parse({ chartSmoothingS: 7 }).chartSmoothingS).toBe(3);
    expect(SettingsSchema.parse({ chartSmoothingS: 0 }).chartSmoothingS).toBe(0);
  });
});
