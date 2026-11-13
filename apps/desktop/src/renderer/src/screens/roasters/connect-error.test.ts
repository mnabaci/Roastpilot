import { describe, expect, it } from 'vitest';
import { connectErrorText } from './connect-error';

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
  ])('%o says what to try', (error, text) => {
    expect(connectErrorText(error)).toContain(text);
  });
});
