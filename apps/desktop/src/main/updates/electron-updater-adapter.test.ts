import { createLogger, type UpdaterEvent } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { adaptUpdater, type AppUpdaterLike } from './electron-updater-adapter';

/** electron-updater's autoUpdater, as an EventEmitter with spies. */
function fakeAutoUpdater() {
  const emitter = new EventEmitter();
  const updater = Object.assign(emitter, {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    allowDowngrade: true,
    logger: null as AppUpdaterLike['logger'],
    checkForUpdates: vi.fn(() =>
      Promise.resolve({ updateInfo: { version: '0.2.0' } } as {
        updateInfo: { version: string };
      } | null),
    ),
    downloadUpdate: vi.fn(() => Promise.resolve<unknown>(['/tmp/Roastpilot-Setup-0.2.0.exe'])),
    quitAndInstall: vi.fn(),
  });
  return updater;
}

function setup(canInstall = true) {
  const raw = fakeAutoUpdater();
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'updates');
  return { raw, entries, updater: adaptUpdater(raw, { canInstall, logger }) };
}

describe('adaptUpdater', () => {
  it('never lets electron-updater download, install or take pre-releases on its own', () => {
    const { raw } = setup();
    expect(raw).toMatchObject({
      autoDownload: false,
      autoInstallOnAppQuit: true,
      allowPrerelease: false,
      allowDowngrade: false,
    });
    expect(setup(false).raw.autoInstallOnAppQuit).toBe(false);
  });

  it('sends electron-updater chatter to the app log at debug level', () => {
    const { raw, entries } = setup();
    raw.logger?.info('Checking for update');
    raw.logger?.error('net::ERR');
    expect(entries.map((e) => [e.level, e.event, e.context])).toEqual([
      ['debug', 'updater.message', { message: 'Checking for update' }],
      ['debug', 'updater.message', { message: 'net::ERR' }],
    ]);
  });

  it('an error event is logged instead of crashing the app', () => {
    const { raw, entries } = setup();
    expect(() => raw.emit('error', new Error('net::ERR_NAME_NOT_RESOLVED'))).not.toThrow();
    expect(entries.map((e) => e.event)).toEqual(['updater.error-event']);
  });

  it('answers the latest version, or the failure as a result', async () => {
    const { raw, updater } = setup();
    expect(await updater.latestVersion()).toEqual({ ok: true, value: '0.2.0' });
    raw.checkForUpdates.mockRejectedValueOnce(new Error('HttpError: 404'));
    expect(await updater.latestVersion()).toEqual({
      ok: false,
      error: { message: 'HttpError: 404' },
    });
    raw.checkForUpdates.mockResolvedValueOnce(null);
    expect(await updater.latestVersion()).toEqual({
      ok: false,
      error: { message: 'The updater is off.' },
    });
  });

  it('downloads on request, a failure as a result', async () => {
    const { raw, updater } = setup();
    expect(await updater.download()).toEqual({ ok: true, value: undefined });
    raw.downloadUpdate.mockRejectedValueOnce('ENOSPC');
    expect(await updater.download()).toEqual({ ok: false, error: { message: 'ENOSPC' } });
  });

  it('installs silently and starts the new version', () => {
    const { raw, updater } = setup();
    updater.quitAndInstall();
    expect(raw.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('passes on progress and downloads until unsubscribed', () => {
    const { raw, updater } = setup();
    const seen: UpdaterEvent[] = [];
    const stop = updater.onEvent((event) => seen.push(event));
    raw.emit('download-progress', { percent: 12.5, bytesPerSecond: 1, total: 8, transferred: 1 });
    raw.emit('update-downloaded', { version: '0.2.0' });
    stop();
    raw.emit('download-progress', { percent: 50 });
    expect(seen).toEqual([
      { kind: 'progress', percent: 12.5 },
      { kind: 'downloaded', version: '0.2.0' },
    ]);
    expect(raw.listenerCount('download-progress')).toBe(0);
  });
});
