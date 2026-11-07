import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './version';

describe('isNewerVersion', () => {
  it.each([
    ['0.2.0', '0.1.0', true],
    ['0.1.1', '0.1.0', true],
    ['1.0.0', '0.9.9', true],
    ['0.10.0', '0.9.0', true],
    ['0.1.0', '0.1.0', false],
    ['0.0.9', '0.1.0', false],
    ['0.9.0', '0.10.0', false],
  ])('%s over %s: %s', (candidate, installed, newer) => {
    expect(isNewerVersion(candidate, installed)).toBe(newer);
  });

  it('a pre-release is never newer', () => {
    expect(isNewerVersion('0.3.0-beta.1', '0.2.0')).toBe(false);
  });

  it('anything that is not a version is never newer', () => {
    expect(isNewerVersion('latest', '0.1.0')).toBe(false);
    expect(isNewerVersion('v0.2.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.2.0', 'unknown')).toBe(false);
  });

  it('compares the numbers of a pre-release install', () => {
    expect(isNewerVersion('0.2.0', '0.2.0-dev')).toBe(false);
    expect(isNewerVersion('0.2.1', '0.2.0-dev')).toBe(true);
  });
});
