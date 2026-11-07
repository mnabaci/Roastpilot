import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appBundlePath, cantReplaceReason, isWritable } from './app-bundle';

const writable = () => true;

describe('appBundlePath', () => {
  it('is the outer .app of the running program', () => {
    expect(appBundlePath('/Applications/Roastpilot.app/Contents/MacOS/Roastpilot')).toBe(
      '/Applications/Roastpilot.app',
    );
    expect(appBundlePath('/Users/me/Apps/Roastpilot.app/Contents/MacOS/Roastpilot')).toBe(
      '/Users/me/Apps/Roastpilot.app',
    );
  });

  it('is undefined outside a bundle', () => {
    expect(appBundlePath('/usr/local/bin/electron')).toBeUndefined();
  });
});

describe('cantReplaceReason', () => {
  it('can replace itself in Applications', () => {
    expect(cantReplaceReason('/Applications/Roastpilot.app', writable)).toBeUndefined();
  });

  it('asks about the folder the app is in', () => {
    const asked: string[] = [];
    cantReplaceReason('/Applications/Roastpilot.app', (dir) => {
      asked.push(dir);
      return true;
    });
    expect(asked).toEqual(['/Applications']);
  });

  it.each([
    [
      'App Translocation',
      '/private/var/folders/x/AppTranslocation/ABC/d/Roastpilot.app',
      'translocated',
    ],
    ['the DMG', '/Volumes/Roastpilot 0.2.0-arm64/Roastpilot.app', 'disk-image'],
    ['no bundle', undefined, 'not-a-bundle'],
  ])('refuses %s', (_name, bundle, reason) => {
    expect(cantReplaceReason(bundle, writable)).toBe(reason);
  });

  it('refuses a folder it cannot write', () => {
    expect(cantReplaceReason('/Applications/Roastpilot.app', () => false)).toBe('read-only');
  });
});

describe.skipIf(process.platform === 'win32')('isWritable', () => {
  it('is true for a folder this user may write, false for a read-only or missing one', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rp-writable-'));
    try {
      expect(isWritable(dir)).toBe(true);
      await chmod(dir, 0o555);
      expect(isWritable(dir)).toBe(false);
      expect(isWritable(join(dir, 'missing'))).toBe(false);
    } finally {
      await chmod(dir, 0o755);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
