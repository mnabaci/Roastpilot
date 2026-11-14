import { modelFacts } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { connectErrorText } from './connect-error';

const SKYWALKER = modelFacts('skywalker');
const TC4 = modelFacts('tc4');

describe('connectErrorText', () => {
  it.each([
    [{ kind: 'disconnected' } as const, 'check the cable'],
    [{ kind: 'no-reply', command: 'VERSION' } as const, 'SkyCommand'],
    [{ kind: 'version-mismatch', expected: 1, actual: null } as const, 'No reply from the roaster'],
    [{ kind: 'version-mismatch', expected: 1, actual: 2 } as const, 'Sketch version 2'],
    [{ kind: 'bad-reply', line: '???' } as const, 'roaster port'],
    [
      { kind: 'wrong-connection', model: 'simulator', expected: 'simulator' } as const,
      'see the log',
    ],
  ])('%o says what to try on a Skywalker', (error, text) => {
    expect(connectErrorText(error, SKYWALKER)).toContain(text);
  });

  it.each([
    [
      { kind: 'no-reply', command: 'CHAN;1200' } as const,
      'No reply · check the baud, and that aArtisanQ_PID is flashed',
    ],
    [
      { kind: 'bad-reply', line: 'hello' } as const,
      'Unexpected reply · check the baud and the aArtisanQ_PID firmware',
    ],
  ])('%o names the baud and the stock firmware on a generic TC4', (error, text) => {
    expect(connectErrorText(error, TC4)).toBe(text);
  });
});
