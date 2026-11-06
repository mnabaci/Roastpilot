import { describe, expect, it } from 'vitest';
import { movePoint } from './draft-edits';
import type { ProfileDraft } from './profile-draft';

const PROFILE = {
  capC: 200,
  curve: [
    { tS: 0, c: 180 },
    { tS: 60, c: 100 },
    { tS: 300, c: 150 },
    { tS: 600, c: 195 },
  ],
};
const DRAFT = {
  points: [
    { time: '1:00', c: '100' },
    { time: '5:00', c: '150' },
    { time: '10:00', c: '195' },
  ],
} as ProfileDraft;

describe('movePoint', () => {
  it('rounds to whole seconds and degrees, as a clock the draft can read', () => {
    expect(movePoint(DRAFT, PROFILE, 1, { t: 245.4, v: 160.6 }).points).toEqual([
      { time: '1:00', c: '100' },
      { time: '4:05', c: '161' },
      { time: '10:00', c: '195' },
    ]);
  });

  it('stays between its neighbours', () => {
    expect(movePoint(DRAFT, PROFILE, 1, { t: 10, v: 150 }).points[1]?.time).toBe('1:01');
    expect(movePoint(DRAFT, PROFILE, 1, { t: 900, v: 150 }).points[1]?.time).toBe('9:59');
  });

  it('stays after charge, and the last point can go later', () => {
    expect(movePoint(DRAFT, PROFILE, 0, { t: -5, v: 100 }).points[0]?.time).toBe('0:01');
    expect(movePoint(DRAFT, PROFILE, 2, { t: 700, v: 195 }).points[2]?.time).toBe('11:40');
  });

  it('stays under the BT cap and above zero', () => {
    expect(movePoint(DRAFT, PROFILE, 2, { t: 600, v: 240 }).points[2]?.c).toBe('200');
    expect(movePoint(DRAFT, PROFILE, 0, { t: 60, v: -3 }).points[0]?.c).toBe('0');
  });
});
