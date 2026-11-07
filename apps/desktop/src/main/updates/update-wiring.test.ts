import { FIRST_CHECK_MS, ManualClock, silentLogger } from '@roastpilot/core';
import type { UpdateStatus } from '@roastpilot/shared';
import { EventEmitter } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppUpdaterLike } from './electron-updater-adapter';
import {
  fakeAutoUpdater as fakeMacAutoUpdater,
  fakeMacEnvironment,
  type MacEnvOptions,
} from './mac/mac-installer.harness';
import { createUpdates, type UpdatesDeps } from './update-wiring';

function fakeAutoUpdater(latest = '0.2.0') {
  return Object.assign(new EventEmitter(), {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: false,
    allowDowngrade: false,
    logger: null as AppUpdaterLike['logger'],
    checkForUpdates: vi.fn(() => Promise.resolve({ updateInfo: { version: latest } })),
    downloadUpdate: vi.fn(() => Promise.resolve<unknown>([])),
    quitAndInstall: vi.fn(),
  });
}

function setup(overrides: Partial<UpdatesDeps> = {}) {
  const clock = new ManualClock();
  const raw = fakeAutoUpdater();
  const published: UpdateStatus[] = [];
  let roasting = false;
  const updater = vi.fn(() => raw);
  const updates = createUpdates({
    packaged: true,
    platform: 'win32',
    version: '0.1.0',
    updater,
    clock,
    wallNowMs: () => Date.UTC(2026, 10, 7) + clock.now(),
    isRoasting: () => roasting,
    publish: (status) => published.push(status),
    // The quit guard: the shutdown finishes at once here.
    shutdownThen: (finish) => {
      finish();
    },
    quit: () => undefined,
    openExternal: () => Promise.resolve(),
    mac: () => {
      throw new Error('Only asked on a Mac');
    },
    logger: silentLogger,
    ...overrides,
  });
  return {
    clock,
    raw,
    updater,
    updates,
    published,
    setRoasting: (on: boolean) => {
      roasting = on;
    },
  };
}

describe('createUpdates', () => {
  it('in development the updater is off and never loaded', async () => {
    const { updates, updater, clock, published } = setup({ packaged: false });
    expect(updates.info()).toEqual({ version: '0.1.0', update: { state: 'off' } });
    await updates.check();
    updates.wake();
    await clock.runFor(FIRST_CHECK_MS * 2);
    expect(updater).not.toHaveBeenCalled();
    expect(published).toEqual([]);
    expect(updates.restart()).toEqual({ ok: false, error: { kind: 'not-ready' } });
  });

  it('on Windows checks 10 s after start, downloads, and publishes each step', async () => {
    const { updates, clock, raw, published } = setup();
    await clock.runFor(FIRST_CHECK_MS);
    expect(raw.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(published.at(-1)).toEqual({ state: 'ready', version: '0.2.0' });
    expect(updates.info().update).toEqual({ state: 'ready', version: '0.2.0' });
  });

  it('Restart to update is refused while a roast runs, and installs once it ends', async () => {
    const { updates, clock, raw, setRoasting } = setup();
    await clock.runFor(FIRST_CHECK_MS);
    setRoasting(true);
    expect(updates.restart()).toEqual({ ok: false, error: { kind: 'roasting' } });
    expect(raw.quitAndInstall).not.toHaveBeenCalled();
    setRoasting(false);
    expect(updates.restart()).toEqual({ ok: true, value: undefined });
    expect(raw.quitAndInstall).toHaveBeenCalledTimes(1);
  });
});

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

/** createUpdates on a fake Mac: our installer, a temp user-data folder, fake ditto and spawn. */
async function onMac(options: MacEnvOptions = {}, overrides: Partial<UpdatesDeps> = {}) {
  const mac = await fakeMacEnvironment(options);
  roots.push(mac.root);
  const raw = fakeMacAutoUpdater();
  const quit = vi.fn();
  const s = setup({
    platform: 'darwin',
    updater: () => raw,
    mac: () => mac.env,
    quit,
    shutdownThen: (finish) => {
      s.updates.installOnQuit();
      finish();
    },
    logger: mac.logger,
    ...overrides,
  });
  return { ...s, mac, raw, quit };
}

describe('createUpdates on macOS', () => {
  it('in Applications: downloads the zip, checks it, and is ready', async () => {
    const { updates, clock, mac, raw } = await onMac();
    await clock.runFor(FIRST_CHECK_MS);
    await vi.waitFor(() => {
      expect(updates.info().update).toEqual({ state: 'ready', version: '0.2.0' });
    });
    expect(mac.env.fetch).toHaveBeenCalledTimes(1);
    expect(raw.downloadUpdate).not.toHaveBeenCalled();
  });

  it('Restart to update is refused mid-roast; after it, the helper starts with relaunch', async () => {
    const { updates, clock, mac, setRoasting, quit } = await onMac();
    await clock.runFor(FIRST_CHECK_MS);
    await vi.waitFor(() => {
      expect(updates.info().update).toMatchObject({ state: 'ready' });
    });
    setRoasting(true);
    expect(updates.restart()).toEqual({ ok: false, error: { kind: 'roasting' } });
    expect(mac.spawn).not.toHaveBeenCalled();
    setRoasting(false);
    expect(updates.restart()).toEqual({ ok: true, value: undefined });
    expect(mac.spawn.mock.calls[0]?.[1]?.[4]).toBe('1');
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('a quit with an update ready installs without relaunch; with nothing ready, never', async () => {
    const idle = await onMac();
    idle.updates.installOnQuit();
    expect(idle.mac.spawn).not.toHaveBeenCalled();
    const { updates, clock, mac } = await onMac();
    await clock.runFor(FIRST_CHECK_MS);
    await vi.waitFor(() => {
      expect(updates.info().update).toMatchObject({ state: 'ready' });
    });
    updates.installOnQuit();
    expect(mac.spawn.mock.calls[0]?.[1]?.[4]).toBe('0');
  });

  it.each<[string, MacEnvOptions]>([
    [
      'App Translocation',
      { exePath: '/private/var/AppTranslocation/A/d/Roastpilot.app/Contents/MacOS/Roastpilot' },
    ],
    ['the DMG', { exePath: '/Volumes/Roastpilot/Roastpilot.app/Contents/MacOS/Roastpilot' }],
    ['a folder it cannot write', { writable: false }],
  ])(
    '%s: announced with the reason, no download; Download opens the release page',
    async (_n, options) => {
      const openExternal = vi.fn(() => Promise.resolve());
      const { updates, clock, mac } = await onMac(options, { openExternal });
      await clock.runFor(FIRST_CHECK_MS);
      expect(updates.info().update).toEqual({
        state: 'available',
        version: '0.2.0',
        reason: 'cant-replace',
      });
      expect(mac.env.fetch).not.toHaveBeenCalled();
      expect(await updates.openReleasePage('latest')).toEqual({ ok: true, value: undefined });
      expect(openExternal).toHaveBeenCalledWith(
        'https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0',
      );
    },
  );

  it('the last install failed: failed at the install step from launch', async () => {
    const mac = await fakeMacEnvironment();
    roots.push(mac.root);
    await mkdir(mac.env.updatesDir, { recursive: true });
    await writeFile(
      join(mac.env.updatesDir, 'install.log'),
      '2026-11-07T14:02:31Z result: failed timeout\n',
    );
    const published: unknown[] = [];
    setup({
      platform: 'darwin',
      updater: () => fakeMacAutoUpdater(),
      mac: () => mac.env,
      publish: (status) => published.push(status),
    });
    await vi.waitFor(() => {
      expect(published).toEqual([{ state: 'failed', stage: 'install' }]);
    });
  });

  it('in development nothing on the Mac is touched, and quit installs nothing', () => {
    const mac = vi.fn();
    const { updates } = setup({ platform: 'darwin', packaged: false, mac });
    updates.installOnQuit();
    expect(mac).not.toHaveBeenCalled();
  });

  it('on Windows a quit leaves installing to electron-updater', () => {
    const mac = vi.fn();
    const { updates, raw } = setup({ mac });
    updates.installOnQuit();
    expect(mac).not.toHaveBeenCalled();
    expect(raw.autoInstallOnAppQuit).toBe(true);
  });
});
