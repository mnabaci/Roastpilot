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
    expect(problemOf({ issues: [{ path: ['firmware'], message: 'Too big' }] })).toBe('Too big');
  });

  it.each([
    [['tuning', 'preheat', 'kp'], 'PID gains'],
    [['model'], 'Model'],
    [['schemaVersion'], 'Profile version'],
    [['coolerHelpsDrum'], 'Bean cooler helps drum'],
    [['needsCalibration'], 'Needs calibration'],
  ])('names %j as "%s"', (path, place) => {
    expect(problemOf({ issues: [{ path, message: 'Must be on' }] })).toBe(`${place}: Must be on`);
  });

  it("says not valid instead of zod's own words", () => {
    const zod = (path: string[], message: string) => problemOf({ issues: [{ path, message }] });
    expect(zod(['maxTempC'], 'Invalid input: expected number, received string')).toBe(
      'Max temp: not valid',
    );
    expect(zod(['model'], 'Invalid option: expected one of "skywalker"|"simulator"')).toBe(
      'Model: not valid',
    );
    expect(zod(['batchG'], 'Too small: expected number to be >0')).toBe('Batch: not valid');
    expect(zod(['firmware'], 'Invalid input: expected string, received number')).toBe('Not valid');
  });

  it('says only the problem when it is about the whole item', () => {
    expect(problemOf({ issues: [{ path: [], message: 'Expected an object' }] })).toBe(
      'Expected an object',
    );
  });

  it('still says something with no issues', () => {
    expect(problemOf({ issues: [] })).toBe('Not valid');
  });
});
