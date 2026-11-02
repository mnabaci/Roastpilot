import { describe, expect, it } from 'vitest';
import { connectErrorText } from './connect-error';

describe('connectErrorText', () => {
  it.each([
    [{ kind: 'disconnected' } as const, 'check the cable'],
    [{ kind: 'no-reply', command: 'VERSION' } as const, 'SkyCommand'],
    [{ kind: 'version-mismatch', expected: 1, actual: null } as const, 'Sketch version unknown'],
    [{ kind: 'bad-reply', line: '???' } as const, 'roaster port'],
  ])('%o says what to try', (error, text) => {
    expect(connectErrorText(error)).toContain(text);
  });
});
