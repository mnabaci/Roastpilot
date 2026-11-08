import { describe, expect, it } from 'vitest';
import { problemOf } from './problem-of';

describe('problemOf', () => {
  it('says the first problem and where it is', () => {
    const issues = [
      { path: ['phases', 0, 'fanPct'], message: 'Too big' },
      { path: ['name'], message: 'Enter a name' },
    ];
    expect(problemOf({ issues })).toBe('Too big (phases.0.fanPct)');
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
