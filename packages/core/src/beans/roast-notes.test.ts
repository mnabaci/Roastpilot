import { describe, expect, it } from 'vitest';
import { roastNote } from './roast-notes';

describe('roastNote', () => {
  it('says what a process is and how it roasts, in a few short lines', () => {
    const natural = roastNote('process', 'natural');
    expect(natural?.[0]).toMatch(/^Natural: /);
    expect(natural?.length).toBeLessThanOrEqual(3);
    expect(natural?.every((line) => line.length <= 90)).toBe(true);
    expect(roastNote('process', 'other')).toBeUndefined();
  });

  it('speaks to species, and not to one that is unset or Other', () => {
    expect(roastNote('species', 'robusta')?.[0]).toMatch(/^Robusta: /);
    expect(roastNote('species', null)).toBeUndefined();
    expect(roastNote('species', 'other')).toBeUndefined();
  });

  it('reads altitude, density, moisture and screen size by band, as the hints do', () => {
    expect(roastNote('altitudeM', 1900)?.[0]).toMatch(/^High grown/);
    expect(roastNote('altitudeM', 1400)?.[0]).toMatch(/^Mid altitude/);
    expect(roastNote('altitudeM', 900)?.[0]).toMatch(/^Low grown/);
    expect(roastNote('densityGL', 820)?.[0]).toMatch(/^Dense/);
    expect(roastNote('densityGL', 650)?.[0]).toMatch(/^Soft/);
    expect(roastNote('moisturePct', 13)?.[0]).toMatch(/^Wet: /);
    expect(roastNote('moisturePct', 8)?.[0]).toMatch(/^Dry: /);
    expect(roastNote('screen', 14)?.[0]).toMatch(/^Small/);
    expect(roastNote('screen', 18)?.[0]).toMatch(/^Large/);
    expect(roastNote('altitudeM', null)).toBeUndefined();
  });

  it('speaks to decaf only when it is', () => {
    expect(roastNote('decaf', true)?.[0]).toMatch(/^Decaf: /);
    expect(roastNote('decaf', false)).toBeUndefined();
  });
});
