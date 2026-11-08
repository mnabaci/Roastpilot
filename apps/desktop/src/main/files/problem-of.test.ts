import { describe, expect, it } from 'vitest';
import { problemOf } from './problem-of';

describe('problemOf', () => {
  it('says the first problem and where it is, in the words the screens use', () => {
    const issues = [
      { path: ['phases', 0, 'fanPct'], message: 'Too big' },
      { path: ['name'], message: 'Enter a name' },
    ];
    expect(problemOf({ issues })).toBe('Step 1: Too big');
    expect(problemOf({ issues: [{ path: ['capC'], message: 'At most 235 °C' }] })).toBe(
      'BT cap: At most 235 °C',
    );
    expect(problemOf({ issues: [{ path: ['curve', 2, 'c'], message: 'Too hot' }] })).toBe(
      'Curve point 3: Too hot',
    );
  });

  it('never shows a code name it has no words for', () => {
    expect(problemOf({ issues: [{ path: ['tuning', 'kp'], message: 'Too big' }] })).toBe('Too big');
  });

  it('says only the problem when it is about the whole item', () => {
    expect(problemOf({ issues: [{ path: [], message: 'Expected an object' }] })).toBe(
      'Expected an object',
    );
  });

  it('still says something with no issues', () => {
    expect(problemOf({ issues: [] })).toBe('Not a valid item');
  });
});
