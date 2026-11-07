import { describe, expect, it } from 'vitest';
import { CURVE } from '../../test/profiles';
import { profileDetail } from './profile-detail';

describe('profileDetail', () => {
  it('says built-in and needs calibration, either or both, or nothing', () => {
    expect(profileDetail(CURVE, true)).toBe('Built-in · Needs calibration');
    expect(profileDetail({ ...CURVE, needsCalibration: false }, true)).toBe('Built-in');
    expect(profileDetail(CURVE, false)).toBe('Needs calibration');
    expect(profileDetail({ ...CURVE, needsCalibration: false }, false)).toBeUndefined();
  });
});
