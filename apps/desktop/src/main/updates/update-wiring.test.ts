import { FIRST_CHECK_MS, ManualClock, silentLogger } from '@roastpilot/core';
import type { UpdateStatus } from '@roastpilot/shared';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { AppUpdaterLike } from './electron-updater-adapter';
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
    openExternal: () => Promise.resolve(),
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

  it('on macOS a newer version is only announced: no download, no install on quit', async () => {
    const { updates, clock, raw } = setup({ platform: 'darwin' });
    await clock.runFor(FIRST_CHECK_MS);
    expect(updates.info().update).toEqual({ state: 'available', version: '0.2.0' });
    expect(raw.downloadUpdate).not.toHaveBeenCalled();
    expect(raw.autoInstallOnAppQuit).toBe(false);
    raw.emit('update-downloaded', { version: '0.2.0' });
    expect(updates.restart()).toEqual({ ok: false, error: { kind: 'not-ready' } });
    expect(raw.quitAndInstall).not.toHaveBeenCalled();
  });

  it('Download opens the release page of the version out', async () => {
    const openExternal = vi.fn(() => Promise.resolve());
    const { updates, clock } = setup({ platform: 'darwin', openExternal });
    await clock.runFor(FIRST_CHECK_MS);
    expect(await updates.openReleasePage('latest')).toEqual({ ok: true, value: undefined });
    expect(openExternal).toHaveBeenCalledWith(
      'https://github.com/mnabaci/Roastpilot/releases/tag/v0.2.0',
    );
  });
});
