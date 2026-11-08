import { describe, expect, it } from 'vitest';
import { CURVE } from '../../test/profiles';
import { profileOption } from './profile-option';

describe('profileOption', () => {
  it('is the name alone, Built-in as its detail and Needs calibration as a badge', () => {
    expect(profileOption({ profile: CURVE, builtIn: true })).toEqual({
      value: CURVE.id,
      label: CURVE.name,
      detail: 'Built-in',
      badge: 'Needs calibration',
    });
  });

  it('has no badge once calibrated, and no detail for your own', () => {
    const option = profileOption({
      profile: { ...CURVE, needsCalibration: false },
      builtIn: false,
    });
    expect(option.detail).toBeUndefined();
    expect(option.badge).toBeUndefined();
  });
});
