import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeCommands, type FakeMac } from './fake-commands.harness';
import { unpackApp } from './unpack-app';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rp-unpack-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const unpack = (mac: FakeMac = {}) => {
  const run = fakeCommands(mac);
  return { run, result: unpackApp('/u/Roastpilot-0.2.0.zip', dir, '0.2.0', run) };
};

describe('unpackApp', () => {
  it('unpacks with ditto, checks the signature, the id and the version', async () => {
    const { run, result } = unpack();
    expect(await result).toEqual({ ok: true, value: join(dir, 'Roastpilot.app') });
    const app = join(dir, 'Roastpilot.app');
    const plist = join(app, 'Contents', 'Info.plist');
    expect(run.mock.calls).toEqual([
      ['/usr/bin/ditto', ['-x', '-k', '/u/Roastpilot-0.2.0.zip', dir]],
      ['/usr/bin/codesign', ['--verify', '--deep', '--strict', app]],
      ['/usr/bin/plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist]],
      ['/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', plist]],
    ]);
  });

  it.each<[string, FakeMac, string]>([
    ['ditto fails', { failing: ['/usr/bin/ditto'] }, '/usr/bin/ditto failed: no'],
    ['codesign fails', { failing: ['/usr/bin/codesign'] }, '/usr/bin/codesign failed: no'],
    ['the plist cannot be read', { failing: ['/usr/bin/plutil'] }, '/usr/bin/plutil failed: no'],
    [
      'the wrong bundle id',
      { bundleId: 'com.evil.app' },
      'The zip holds com.evil.app, not Roastpilot',
    ],
    ['the wrong version', { version: '0.1.9' }, 'The zip holds version 0.1.9, not 0.2.0'],
    ['no app', { apps: [] }, 'The zip holds 0 apps, not one'],
    ['two apps', { apps: ['Roastpilot.app', 'Other.app'] }, 'The zip holds 2 apps, not one'],
  ])('%s: refused', async (_name, mac, message) => {
    expect(await unpack(mac).result).toEqual({ ok: false, error: { message } });
  });

  it('a failed signature check never reads the app', async () => {
    const { run, result } = unpack({ failing: ['/usr/bin/codesign'] });
    await result;
    expect(run.mock.calls.map(([file]) => file)).not.toContain('/usr/bin/plutil');
  });
});
