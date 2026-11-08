import { describe, expect, it } from 'vitest';
import { chooseUserData, USER_DATA_ENV } from './user-data-dir';

const dir = process.platform === 'win32' ? 'C:\\tmp\\rp-check' : '/tmp/rp-check';

describe('chooseUserData', () => {
  it('keeps the default folder without the env var', () => {
    expect(chooseUserData({}, false)).toEqual({ kind: 'default' });
  });

  it('keeps the default folder when the env var is blank', () => {
    expect(chooseUserData({ [USER_DATA_ENV]: '  ' }, false)).toEqual({ kind: 'default' });
  });

  it('uses the env var folder in a development run', () => {
    expect(chooseUserData({ [USER_DATA_ENV]: dir }, false)).toEqual({ kind: 'override', dir });
  });

  it('ignores the env var in a packaged app, so real data is never swapped out', () => {
    expect(chooseUserData({ [USER_DATA_ENV]: dir }, true)).toEqual({
      kind: 'ignored',
      reason: 'packaged',
      value: dir,
    });
  });

  it('ignores a relative folder, which would depend on where the app was started', () => {
    expect(chooseUserData({ [USER_DATA_ENV]: 'tmp/rp' }, false)).toEqual({
      kind: 'ignored',
      reason: 'not-absolute',
      value: 'tmp/rp',
    });
  });
});
