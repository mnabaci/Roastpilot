import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema } from './settings';

const ROAST_DEFAULTS = {
  findChargePoint: true,
  coolingEnd: 'time',
  coolingTimeMin: 4,
  coolingBelowC: 90,
  coolRoasterAfter: true,
  roasterCoolToC: 50,
  roastMode: 'manual',
  autoProfile: 'light-steps',
  soakTimeS: 60,
};

describe('SettingsSchema', () => {
  it('stays on Manual with a 1:00 soak unless you choose otherwise', () => {
    expect(DEFAULT_SETTINGS.roastMode).toBe('manual');
    expect(DEFAULT_SETTINGS.soakTimeS).toBe(60);
  });

  it('keeps a chosen Auto setup', () => {
    const chosen = { roastMode: 'auto', autoProfile: 'light-curve', soakTimeS: 90 };
    expect(SettingsSchema.parse(chosen)).toMatchObject(chosen);
  });

  it('falls back on a soak time that is not offered, or an unknown profile', () => {
    const parsed = SettingsSchema.parse({ soakTimeS: 7, autoProfile: 'dark', roastMode: 'auto' });
    expect(parsed).toMatchObject({
      roastMode: 'auto',
      autoProfile: 'light-steps',
      soakTimeS: 60,
    });
  });

  it('defaults to Guided and no roaster', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      connection: null,
      controls: 'guided',
      chartSmoothingS: 3,
      ...ROAST_DEFAULTS,
    });
  });

  it('keeps valid settings', () => {
    const settings = {
      connection: { kind: 'serial', path: 'COM3' },
      controls: 'full',
      chartSmoothingS: 10,
      findChargePoint: false,
      coolingEnd: 'temperature',
      coolingTimeMin: 6,
      coolingBelowC: 70,
      coolRoasterAfter: false,
      roasterCoolToC: 40,
      roastMode: 'auto',
      autoProfile: 'light-curve',
      soakTimeS: 90,
    };
    expect(SettingsSchema.parse(settings)).toEqual(settings);
  });

  it('falls back field by field, so one bad value does not lose the rest', () => {
    expect(SettingsSchema.parse({ connection: { kind: 'wifi' }, controls: 'full' })).toEqual({
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
      ...ROAST_DEFAULTS,
    });
    expect(SettingsSchema.parse({ connection: { kind: 'simulator' }, controls: 'expert' })).toEqual(
      {
        connection: { kind: 'simulator' },
        controls: 'guided',
        chartSmoothingS: 3,
        ...ROAST_DEFAULTS,
      },
    );
  });

  it('ignores fields it does not know', () => {
    expect(SettingsSchema.parse({ controls: 'full', theme: 'neon' })).toEqual({
      connection: null,
      controls: 'full',
      chartSmoothingS: 3,
      ...ROAST_DEFAULTS,
    });
  });

  it('turns an unknown smoothing into the 3 s default', () => {
    expect(SettingsSchema.parse({ chartSmoothingS: 7 }).chartSmoothingS).toBe(3);
    expect(SettingsSchema.parse({ chartSmoothingS: 0 }).chartSmoothingS).toBe(0);
  });

  it('finds the charge point, cools 4 min and cools the roaster after, unless set otherwise', () => {
    expect(SettingsSchema.parse({ coolingTimeMin: 9, findChargePoint: 'yes' })).toMatchObject(
      ROAST_DEFAULTS,
    );
    expect(SettingsSchema.parse({ coolingTimeMin: 2 }).coolingTimeMin).toBe(2);
  });

  it('cools by time to 90 °C and the roaster to 50 °C unless set; odd values fall back', () => {
    expect(
      SettingsSchema.parse({ coolingEnd: 'colour', coolingBelowC: 85, roasterCoolToC: 20 }),
    ).toMatchObject({ coolingEnd: 'time', coolingBelowC: 90, roasterCoolToC: 50 });
  });
});
