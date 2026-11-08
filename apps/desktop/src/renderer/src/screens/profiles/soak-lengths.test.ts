import { describe, expect, it } from 'vitest';
import { soakFromValue, soakOptions, soakValue } from './soak-lengths';

describe('soakOptions', () => {
  it('is Off, then each length a soak can run', () => {
    expect(soakOptions(60).map((o) => o.label)).toEqual([
      'Off',
      '0:30',
      '0:45',
      '1:00',
      '1:15',
      '1:30',
      '2:00',
    ]);
  });

  it('lists a length from elsewhere in its place, so it shows as it is', () => {
    expect(soakOptions(66).map((o) => o.label)).toContain('1:06');
    expect(soakOptions(66).findIndex((o) => o.label === '1:06')).toBe(4);
  });
});

describe('soakValue and soakFromValue', () => {
  it('go both ways, Off being none', () => {
    expect(soakFromValue(soakValue(null))).toBeNull();
    expect(soakFromValue(soakValue(75))).toBe(75);
  });
});
