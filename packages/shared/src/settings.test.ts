import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  needsSafetyNotice,
  SAFETY_NOTICE_VERSION,
  SettingsSchema,
} from './settings';
import { DEFAULT_SOUNDS } from './sounds';

const ROAST_DEFAULTS = {
  chartProjection: true,
  chartNowLine: true,
  chartTemperatureFocus: true,
  chartPhaseBands: true,
  findChargePoint: true,
  coachInManual: true,
  coolingTimeMin: 4,
  coolRoasterAfter: true,
  roasterCoolToC: 50,
  roastMode: 'manual',
  autoProfile: 'light-steps',
  sounds: DEFAULT_SOUNDS,
  theme: 'dark',
  safetyNoticeAccepted: 0,
};

describe('SettingsSchema', () => {
  it('stays on Manual unless you choose otherwise', () => {
    expect(DEFAULT_SETTINGS.roastMode).toBe('manual');
  });

  it('keeps a chosen Auto setup', () => {
    const chosen = { roastMode: 'auto', autoProfile: 'light-curve' };
    expect(SettingsSchema.parse(chosen)).toMatchObject(chosen);
  });

  it('falls back on an unknown profile', () => {
    const parsed = SettingsSchema.parse({ autoProfile: 5, roastMode: 'auto' });
    expect(parsed).toMatchObject({ roastMode: 'auto', autoProfile: 'light-steps' });
  });

  it('reads a file from before the soak moved into profiles, without the old setting', () => {
    const parsed = SettingsSchema.parse({ roastMode: 'auto', soakTimeS: 90 });
    expect(parsed).toEqual({ ...DEFAULT_SETTINGS, roastMode: 'auto' });
  });

  it('shows the safety notice until this version is accepted', () => {
    expect(needsSafetyNotice(DEFAULT_SETTINGS)).toBe(true);
    const accepted = { ...DEFAULT_SETTINGS, safetyNoticeAccepted: SAFETY_NOTICE_VERSION };
    expect(needsSafetyNotice(accepted)).toBe(false);
    expect(
      needsSafetyNotice({ ...accepted, safetyNoticeAccepted: SAFETY_NOTICE_VERSION - 1 }),
    ).toBe(true);
  });

  it('asks again for a safety notice version that is not a whole number', () => {
    expect(SettingsSchema.parse({ safetyNoticeAccepted: 'yes' }).safetyNoticeAccepted).toBe(0);
    expect(SettingsSchema.parse({ safetyNoticeAccepted: 1.5 }).safetyNoticeAccepted).toBe(0);
  });

  it('stays dark unless you choose a theme, and falls back to dark on an unknown one', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(SettingsSchema.parse({ theme: 'light' }).theme).toBe('light');
    expect(SettingsSchema.parse({ theme: 'sepia' }).theme).toBe('dark');
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
      chartProjection: false,
      chartNowLine: false,
      chartTemperatureFocus: false,
      chartPhaseBands: false,
      findChargePoint: false,
      coachInManual: false,
      coolingTimeMin: 6,
      coolRoasterAfter: false,
      roasterCoolToC: 40,
      roastMode: 'auto',
      autoProfile: 'light-curve',
      sounds: {
        enabled: false,
        steps: {
          ...DEFAULT_SOUNDS.steps,
          'beans-in': { voice: 'bell', volumePct: 55, repeat: 'twice' },
        },
      },
      theme: 'system',
      safetyNoticeAccepted: 1,
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

  it('turns the chart aids on for a file from before they existed, and on for a bad value', () => {
    const parsed = SettingsSchema.parse({ chartSmoothingS: 5, chartNowLine: 'no' });
    expect(parsed).toMatchObject({
      chartSmoothingS: 5,
      chartProjection: true,
      chartNowLine: true,
      chartTemperatureFocus: true,
      chartPhaseBands: true,
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

  it('coaches manual roasts unless you turn it off, and reads an older file as on', () => {
    expect(SettingsSchema.parse({ controls: 'full' }).coachInManual).toBe(true);
    expect(SettingsSchema.parse({ coachInManual: 'no' }).coachInManual).toBe(true);
    expect(SettingsSchema.parse({ coachInManual: false }).coachInManual).toBe(false);
  });

  it('an older file without sounds plays the default sound for each step', () => {
    expect(SettingsSchema.parse({ controls: 'full' }).sounds).toEqual({
      enabled: true,
      steps: {
        'charge-soon': { voice: 'chime', volumePct: 80, repeat: 'until-done' },
        'beans-in': { voice: 'chime', volumePct: 80, repeat: 'until-done' },
        'listen-first-crack': { voice: 'ping', volumePct: 70, repeat: 'once' },
        'dump-beans': { voice: 'chime', volumePct: 80, repeat: 'twice' },
        'auto-stopped': { voice: 'alert', volumePct: 90, repeat: 'thrice' },
      },
    });
    expect(SettingsSchema.parse({ sounds: 'loud' }).sounds).toEqual(DEFAULT_SOUNDS);
  });

  it('a bad voice or volume falls back for that step only', () => {
    const { sounds } = SettingsSchema.parse({
      sounds: {
        enabled: false,
        steps: {
          'beans-in': { voice: 'trumpet', volumePct: 40 },
          'dump-beans': { voice: 'bell', volumePct: 33 },
        },
      },
    });
    expect(sounds.enabled).toBe(false);
    expect(sounds.steps['beans-in']).toEqual({
      voice: 'chime',
      volumePct: 40,
      repeat: 'until-done',
    });
    expect(sounds.steps['dump-beans']).toEqual({ voice: 'bell', volumePct: 80, repeat: 'twice' });
    expect(sounds.steps['auto-stopped']).toEqual({
      voice: 'alert',
      volumePct: 90,
      repeat: 'thrice',
    });
  });

  it('an older step without a repeat gets its default; a bad one falls back for that step only', () => {
    const { sounds } = SettingsSchema.parse({
      sounds: {
        steps: {
          'charge-soon': { voice: 'bell', volumePct: 40 },
          'dump-beans': { voice: 'bell', volumePct: 50, repeat: 'forever' },
          'auto-stopped': { voice: 'beep', volumePct: 60, repeat: 'once' },
        },
      },
    });
    expect(sounds.steps['charge-soon']).toEqual({
      voice: 'bell',
      volumePct: 40,
      repeat: 'until-done',
    });
    expect(sounds.steps['dump-beans']).toEqual({ voice: 'bell', volumePct: 50, repeat: 'twice' });
    expect(sounds.steps['auto-stopped']).toEqual({ voice: 'beep', volumePct: 60, repeat: 'once' });
    expect(sounds.steps['listen-first-crack'].repeat).toBe('once');
  });

  it('cools the drum to 50 °C unless set; an odd value falls back', () => {
    expect(SettingsSchema.parse({ roasterCoolToC: 20 }).roasterCoolToC).toBe(50);
  });

  it('an older file that cooled the beans by temperature loads, cooling by time', () => {
    const parsed = SettingsSchema.parse({
      coolingEnd: 'temperature',
      coolingBelowC: 80,
      coolingTimeMin: 5,
    });
    expect(parsed.coolingTimeMin).toBe(5);
    expect(parsed).not.toHaveProperty('coolingEnd');
    expect(parsed).not.toHaveProperty('coolingBelowC');
  });
});
