import type { UpdaterEvent } from '@roastpilot/core';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMacInstaller, type MacInstaller } from './mac-installer';
import {
  fakeAutoUpdater,
  fakeMacEnvironment,
  fetchBytes,
  HELPER,
  RELEASE,
  ZIP_BYTES,
  ZIP_URL,
  type MacEnvOptions,
} from './mac-installer.harness';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function setup(options: MacEnvOptions = {}, release = RELEASE) {
  const mac = await fakeMacEnvironment(options);
  roots.push(mac.root);
  const raw = fakeAutoUpdater(release);
  const calls: string[] = [];
  const make = (): MacInstaller =>
    createMacInstaller({
      ...mac.env,
      autoUpdater: raw,
      // The quit guard: its steps (the install step among them) run, then `finish`.
      shutdownThen: (finish) => {
        calls.push('shutdown');
        installer.installOnQuit();
        finish();
      },
      quit: () => calls.push('quit'),
      logger: mac.logger,
    });
  const installer = make();
  const progress: number[] = [];
  installer.updater.onEvent((event: UpdaterEvent) => {
    if (event.kind === 'progress') progress.push(event.percent);
  });
  const updates = mac.env.updatesDir;
  const stagedApp = join(updates, '0.2.0', 'Roastpilot.app');
  /** Found and downloaded, as UpdateService would do it. */
  const fetched = async () => {
    await installer.updater.latestVersion();
    return installer.updater.download();
  };
  return { ...mac, raw, installer, calls, progress, updates, stagedApp, fetched, relaunch: make };
}

const helperArgs = (relaunch: '0' | '1', updates: string, staged: string) => [
  HELPER,
  '4242',
  '/Applications/Roastpilot.app',
  staged,
  relaunch,
  join(updates, 'install.log'),
];

describe('createMacInstaller: finding and downloading', () => {
  it('electron-updater only finds the release: never downloads or installs on a Mac', async () => {
    const s = await setup();
    expect(s.raw).toMatchObject({
      autoDownload: false,
      autoInstallOnAppQuit: false,
      allowPrerelease: false,
      allowDowngrade: false,
    });
    expect(await s.installer.updater.latestVersion()).toEqual({ ok: true, value: '0.2.0' });
    expect(await s.installer.updater.download()).toEqual({ ok: true, value: undefined });
    expect(s.raw.downloadUpdate).not.toHaveBeenCalled();
    expect(s.raw.quitAndInstall).not.toHaveBeenCalled();
  });

  it('downloads the zip from the release, checks it, unpacks it and keeps only the app', async () => {
    const s = await setup();
    expect(await s.fetched()).toEqual({ ok: true, value: undefined });
    expect(s.env.fetch).toHaveBeenCalledWith(ZIP_URL);
    expect(s.progress.at(-1)).toBe(100);
    expect(await readdir(s.updates)).toEqual(['0.2.0']);
    expect(existsSync(s.stagedApp)).toBe(true);
    expect(s.events()).toContain('update.staged');
  });

  it('download before a check found anything is a failure', async () => {
    const s = await setup();
    expect(await s.installer.updater.download()).toMatchObject({ ok: false });
  });

  it('a failed check, or an updater that is off, is a failure', async () => {
    const s = await setup();
    s.raw.checkForUpdates.mockRejectedValueOnce(new Error('net::ERR_NAME_NOT_RESOLVED'));
    expect(await s.installer.updater.latestVersion()).toEqual({
      ok: false,
      error: { message: 'net::ERR_NAME_NOT_RESOLVED' },
    });
    s.raw.checkForUpdates.mockResolvedValueOnce(null);
    expect(await s.installer.updater.latestVersion()).toMatchObject({ ok: false });
  });

  it('a hash mismatch deletes the download: verify-failed', async () => {
    const s = await setup({ fetch: fetchBytes(Buffer.from('the zip of Roastpilot 0.2.X')) });
    expect(await s.fetched()).toMatchObject({ ok: false, error: { kind: 'verify' } });
    expect(await readdir(s.updates)).toEqual([]);
    expect(s.events()).toContain('update.verify-failed');
  });

  it('a wrong size deletes the download: verify-failed', async () => {
    const s = await setup({ fetch: fetchBytes(Buffer.concat([ZIP_BYTES, Buffer.from('!')])) });
    expect(await s.fetched()).toMatchObject({ ok: false, error: { kind: 'verify' } });
    expect(await readdir(s.updates)).toEqual([]);
  });

  it('a zip outside the release, or over plain http, is refused before any download', async () => {
    const http = 'http://github.com/mnabaci/Roastpilot/releases/download/v0.2.0/R.zip';
    const s = await setup({}, { version: '0.2.0', files: [{ url: http, sha512: 'x', size: 1 }] });
    expect(await s.fetched()).toMatchObject({ ok: false });
    expect(s.env.fetch).not.toHaveBeenCalled();
    expect(s.events()).toContain('update.verify-failed');
  });

  it('a network error mid-download leaves nothing, and the next try downloads again', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('net::ERR_CONNECTION_RESET'))
      .mockImplementation(() => Promise.resolve(new Response(new Uint8Array(ZIP_BYTES))));
    const s = await setup({ fetch });
    expect(await s.fetched()).toMatchObject({ ok: false, error: { kind: 'download' } });
    expect(await readdir(s.updates)).toEqual([]);
    expect(await s.fetched()).toEqual({ ok: true, value: undefined });
  });

  it.each<[string, MacEnvOptions]>([
    ['ditto fails', { failing: ['/usr/bin/ditto'] }],
    ['codesign fails', { failing: ['/usr/bin/codesign'] }],
    ['the wrong bundle id', { bundleId: 'com.other.app' }],
    ['the wrong version', { version: '0.1.9' }],
    ['no app in the zip', { apps: [] }],
    ['two apps in the zip', { apps: ['Roastpilot.app', 'Other.app'] }],
  ])('%s: everything downloaded is deleted, verify-failed', async (_name, options) => {
    const s = await setup(options);
    expect(await s.fetched()).toMatchObject({ ok: false });
    expect(await readdir(s.updates)).toEqual([]);
    expect(s.events()).toContain('update.verify-failed');
  });

  it('a disk that fails outside the download is a failure, not a throw', async () => {
    const s = await setup();
    // A file where the updates folder should be: mkdir fails.
    await writeFile(s.updates, 'not a folder');
    await s.installer.lastInstall;
    expect(await s.fetched()).toMatchObject({ ok: false });
  });
});

describe('createMacInstaller: can it replace itself', () => {
  it.each<[string, MacEnvOptions]>([
    [
      'App Translocation',
      { exePath: '/private/var/AppTranslocation/X/d/Roastpilot.app/Contents/MacOS/Roastpilot' },
    ],
    ['the DMG', { exePath: '/Volumes/Roastpilot/Roastpilot.app/Contents/MacOS/Roastpilot' }],
    ['a folder it cannot write', { writable: false }],
  ])('%s: no, logged once', async (_name, options) => {
    const s = await setup(options);
    expect(s.installer.canInstall()).toBe(false);
    expect(s.installer.canInstall()).toBe(false);
    expect(s.events().filter((e) => e === 'update.cant-replace')).toHaveLength(1);
  });

  it('in Applications: yes', async () => {
    const s = await setup();
    expect(s.installer.canInstall()).toBe(true);
    expect(s.events()).not.toContain('update.cant-replace');
  });
});

describe('createMacInstaller: installing', () => {
  it('Restart to update: the shutdown, then the helper with relaunch, then quit', async () => {
    const s = await setup();
    await s.fetched();
    s.installer.updater.quitAndInstall();
    expect(s.calls).toEqual(['shutdown', 'quit']);
    expect(s.spawn).toHaveBeenCalledTimes(1);
    expect(s.spawn).toHaveBeenCalledWith('/bin/sh', helperArgs('1', s.updates, s.stagedApp));
    expect(s.children[0]?.child.unref).toHaveBeenCalled();
    expect(s.events()).toContain('update.installing');
  });

  it('a normal quit with an update ready runs the helper without relaunch, once', async () => {
    const s = await setup();
    await s.fetched();
    s.installer.installOnQuit();
    s.installer.installOnQuit();
    expect(s.spawn).toHaveBeenCalledTimes(1);
    expect(s.spawn).toHaveBeenCalledWith('/bin/sh', helperArgs('0', s.updates, s.stagedApp));
  });

  it('a quit with nothing ready never runs the helper', async () => {
    const s = await setup();
    s.installer.installOnQuit();
    await s.installer.updater.latestVersion();
    s.installer.installOnQuit();
    expect(s.spawn).not.toHaveBeenCalled();
  });

  it('quitting during a download installs nothing; the next launch deletes the partial file', async () => {
    let send: (() => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          send = () => {
            resolve(new Response(new Uint8Array(ZIP_BYTES)));
          };
        }),
    );
    const s = await setup({ fetch });
    await s.installer.updater.latestVersion();
    const downloading = s.installer.updater.download();
    await vi.waitFor(() => {
      expect(send).toBeDefined();
    });
    s.installer.installOnQuit();
    expect(s.spawn).not.toHaveBeenCalled();
    // The process ends here; what it left behind:
    await writeFile(join(s.updates, 'Roastpilot-0.2.0.zip'), 'half a zip');
    const next = s.relaunch();
    await next.lastInstall;
    expect(await readdir(s.updates)).toEqual([]);
    send?.();
    await downloading;
  });

  it('a helper that cannot be spawned is logged, and the app still quits', async () => {
    const s = await setup();
    await s.fetched();
    s.spawn.mockImplementationOnce(() => {
      throw new Error('spawn EAGAIN');
    });
    expect(() => {
      s.installer.updater.quitAndInstall();
    }).not.toThrow();
    expect(s.calls).toEqual(['shutdown', 'quit']);
    expect(s.entries.find((e) => e.event === 'update.install-start-failed')).toMatchObject({
      level: 'error',
      context: { error: { message: 'spawn EAGAIN' } },
    });
  });

  it('a helper the system fails to start later is logged', async () => {
    const s = await setup();
    await s.fetched();
    s.installer.installOnQuit();
    s.children[0]?.child.fail(new Error('spawn /bin/sh ENOENT'));
    expect(s.events()).toContain('update.install-start-failed');
  });

  it('Restart to update with nothing ready, or the helper missing, throws before any shutdown', async () => {
    const s = await setup({ helperThere: false });
    expect(() => {
      s.installer.updater.quitAndInstall();
    }).toThrow('No update is ready');
    await s.fetched();
    expect(() => {
      s.installer.updater.quitAndInstall();
    }).toThrow('The update helper is missing');
    expect(s.calls).toEqual([]);
  });
});

describe('createMacInstaller: at launch', () => {
  it('reads a failed install from the log, deletes it and the leftovers', async () => {
    const s = await setup();
    await s.installer.lastInstall;
    await mkdir(join(s.updates, '0.2.0', 'Roastpilot.app'), { recursive: true });
    // The helper runs only on macOS, so its log always has Mac paths (the tests also run on Windows).
    const staged = '/Users/me/Library/Application Support/Roastpilot/updates/0.2.0/Roastpilot.app';
    await writeFile(
      join(s.updates, 'install.log'),
      `2026-11-07T14:02:01Z staged: ${staged}\n2026-11-07T14:02:31Z result: failed timeout\n`,
    );
    const next = s.relaunch();
    expect(await next.lastInstall).toEqual({ ok: false, version: '0.2.0', reason: 'timeout' });
    expect(await readdir(s.updates)).toEqual([]);
  });

  it('no log: nothing to report', async () => {
    const s = await setup();
    expect(await s.installer.lastInstall).toBeUndefined();
  });

  it('a download waits for the launch cleanup, so it never deletes a fresh download', async () => {
    const s = await setup();
    await mkdir(s.updates, { recursive: true });
    await writeFile(join(s.updates, 'install.log'), 'result: ok\n');
    const next = s.relaunch();
    await next.updater.latestVersion();
    expect(await next.updater.download()).toEqual({ ok: true, value: undefined });
    expect(await readdir(s.updates)).toEqual(['0.2.0']);
  });
});
