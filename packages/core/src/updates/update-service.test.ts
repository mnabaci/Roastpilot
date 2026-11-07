import { ok } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { CHECK_EVERY_MS, FIRST_CHECK_MS, SCHEDULE_POLL_MS } from './update-schedule';
import { updateHarness, WALL_START_MS } from './update-service.harness';

const HOUR_MS = 60 * 60 * 1000;
const isoAt = (clockMs: number) => new Date(WALL_START_MS + clockMs).toISOString();

describe('UpdateService: schedule', () => {
  it('starts idle and checks 10 s after start, not before', async () => {
    const h = updateHarness();
    expect(h.service.status).toEqual({ state: 'idle', checkedAt: null });
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS - 1);
    expect(h.updater.latestVersion).not.toHaveBeenCalled();
    await h.clock.runFor(1);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(1);
    expect(h.statuses).toEqual([
      { state: 'checking' },
      { state: 'idle', checkedAt: isoAt(FIRST_CHECK_MS) },
    ]);
  });

  it('checks again every 24 h, not in between', async () => {
    const h = updateHarness();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS + CHECK_EVERY_MS - HOUR_MS);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(1);
    await h.clock.runFor(HOUR_MS + SCHEDULE_POLL_MS);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(2);
    await h.clock.runFor(CHECK_EVERY_MS);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(3);
  });

  it('a second start runs no second schedule', async () => {
    const h = updateHarness();
    h.service.start();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(1);
  });

  it('a computer that slept for days checks once when it wakes, not once per day', async () => {
    const h = updateHarness();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    h.sleep(3 * CHECK_EVERY_MS);
    h.service.wake();
    h.service.wake();
    await h.settle();
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(2);
    await h.clock.runFor(2 * SCHEDULE_POLL_MS);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(2);
  });

  it('a slept-through day is caught by the next hourly look even without a wake', async () => {
    const h = updateHarness();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    h.sleep(2 * CHECK_EVERY_MS);
    await h.clock.runFor(SCHEDULE_POLL_MS);
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(2);
  });

  it('a clock jump that skips many timers at once runs one check', async () => {
    const h = updateHarness();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    h.clock.advance(3 * CHECK_EVERY_MS);
    await h.settle();
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(2);
  });

  it('wake within the day does not check', async () => {
    const h = updateHarness();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    h.sleep(HOUR_MS);
    h.service.wake();
    await h.settle();
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(1);
  });

  it('a computer clock set back counts as due', async () => {
    const h = updateHarness();
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    h.sleep(-HOUR_MS * 2);
    h.service.wake();
    await h.settle();
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(2);
  });

  it('dispose stops the schedule and the events', async () => {
    const h = updateHarness();
    h.service.start();
    h.service.dispose();
    await h.clock.runFor(FIRST_CHECK_MS + 3 * CHECK_EVERY_MS);
    h.service.wake();
    await h.service.check();
    expect(h.updater.latestVersion).not.toHaveBeenCalled();
    expect(h.listening()).toBe(false);
    expect(h.statuses).toEqual([]);
  });
});

describe('UpdateService: checking', () => {
  it('a failed check shows failed, logs update.check-failed, and never throws', async () => {
    const h = updateHarness();
    h.latest(h.fail());
    await expect(h.service.check()).resolves.toBeUndefined();
    expect(h.service.status).toEqual({ state: 'failed', stage: 'check' });
    expect(h.logs.find((e) => e.event === 'update.check-failed')).toMatchObject({
      level: 'warn',
      context: { error: { message: 'net::ERR_INTERNET_DISCONNECTED' } },
    });
  });

  it('an updater that throws instead of failing counts as a failed check', async () => {
    const h = updateHarness();
    h.latest(new Error('boom'));
    await h.service.check();
    expect(h.service.status).toEqual({ state: 'failed', stage: 'check' });
    expect(h.events()).toContain('update.check-failed');
  });

  it('after a failure the next daily check tries again', async () => {
    const h = updateHarness();
    h.latest(h.fail());
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    expect(h.service.status).toEqual({ state: 'failed', stage: 'check' });
    await h.clock.runFor(CHECK_EVERY_MS + SCHEDULE_POLL_MS);
    expect(h.service.status).toMatchObject({ state: 'idle' });
  });

  it('a check while one is running asks the updater once', async () => {
    const h = updateHarness();
    const held = h.holdLatest();
    const first = h.service.check();
    await h.service.check();
    held.resolve(ok('0.1.0'));
    await first;
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(1);
  });

  it('a version that is not newer, or a pre-release, leaves it up to date', async () => {
    const h = updateHarness({ installedVersion: '0.2.0' });
    h.latest(ok('0.1.9'), ok('0.3.0-beta.1'));
    await h.service.check();
    expect(h.service.status).toMatchObject({ state: 'idle' });
    await h.service.check();
    expect(h.service.status).toMatchObject({ state: 'idle' });
    expect(h.updater.download).not.toHaveBeenCalled();
  });

  it('an answer that arrives after dispose changes nothing', async () => {
    const h = updateHarness();
    const held = h.holdLatest();
    const checking = h.service.check();
    h.service.dispose();
    held.resolve(ok('0.2.0'));
    await checking;
    expect(h.service.status).toEqual({ state: 'checking' });
    expect(h.updater.download).not.toHaveBeenCalled();
  });
});

describe('UpdateService: Windows (can install)', () => {
  it('downloads a newer version, shows progress, then ready', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    const gate = h.holdDownload();
    const checking = h.service.check();
    await h.settle();
    h.emit({ kind: 'progress', percent: 44.6 });
    h.emit({ kind: 'progress', percent: 44.9 });
    gate.resolve(ok(undefined));
    await checking;
    expect(h.statuses).toEqual([
      { state: 'checking' },
      { state: 'downloading', version: '0.2.0', percent: 0 },
      { state: 'downloading', version: '0.2.0', percent: 45 },
      { state: 'ready', version: '0.2.0' },
    ]);
    expect(h.events()).toEqual(['update.downloading', 'update.ready']);
  });

  it('progress is clamped to 0–100 and ignored when nothing downloads', async () => {
    const h = updateHarness();
    h.emit({ kind: 'progress', percent: 50 });
    expect(h.statuses).toEqual([]);
    h.latest(ok('0.2.0'));
    const gate = h.holdDownload();
    const checking = h.service.check();
    await h.settle();
    h.emit({ kind: 'progress', percent: 120 });
    expect(h.service.status).toEqual({ state: 'downloading', version: '0.2.0', percent: 100 });
    h.emit({ kind: 'progress', percent: -5 });
    expect(h.service.status).toEqual({ state: 'downloading', version: '0.2.0', percent: 0 });
    gate.resolve(ok(undefined));
    await checking;
  });

  it('a check during the download, or once ready, asks nothing', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    const gate = h.holdDownload();
    const checking = h.service.check();
    await h.settle();
    await h.service.check();
    gate.resolve(ok(undefined));
    await checking;
    await h.service.check();
    expect(h.updater.latestVersion).toHaveBeenCalledTimes(1);
    expect(h.updater.download).toHaveBeenCalledTimes(1);
  });

  it('a failed or half-done download shows failed, and the next check downloads again', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'), ok('0.2.0'));
    h.downloads(h.fail('sha512 checksum mismatch'));
    await h.service.check();
    expect(h.service.status).toEqual({ state: 'failed', stage: 'download' });
    expect(h.logs.find((e) => e.event === 'update.download-failed')).toMatchObject({
      context: { version: '0.2.0', error: { message: 'sha512 checksum mismatch' } },
    });
    await h.service.check();
    expect(h.service.status).toEqual({ state: 'ready', version: '0.2.0' });
  });

  it('a download that throws counts as failed', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    h.downloads(new Error('ENOSPC'));
    await h.service.check();
    expect(h.service.status).toEqual({ state: 'failed', stage: 'download' });
  });

  it('a downloaded event for the version downloading makes it ready once', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    const gate = h.holdDownload();
    const checking = h.service.check();
    await h.settle();
    h.emit({ kind: 'downloaded', version: '0.1.5' });
    expect(h.service.status).toMatchObject({ state: 'downloading' });
    h.emit({ kind: 'downloaded', version: '0.2.0' });
    expect(h.service.status).toEqual({ state: 'ready', version: '0.2.0' });
    gate.resolve(ok(undefined));
    await checking;
    expect(h.statuses.filter((s) => s.state === 'ready')).toHaveLength(1);
  });

  it('events after dispose are ignored', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    const gate = h.holdDownload();
    const checking = h.service.check();
    await h.settle();
    const before = h.statuses.length;
    h.service.dispose();
    h.emit({ kind: 'progress', percent: 80 });
    gate.resolve(ok(undefined));
    await checking;
    expect(h.statuses).toHaveLength(before);
  });

  it('a scheduled check during a roast still downloads; only the restart waits', async () => {
    const h = updateHarness();
    h.setRoasting(true);
    h.latest(ok('0.2.0'));
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS);
    expect(h.service.status).toEqual({ state: 'ready', version: '0.2.0' });
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'roasting' } });
    expect(h.updater.quitAndInstall).not.toHaveBeenCalled();
    expect(h.events()).toContain('update.restart-refused');
  });

  it('restart is refused once a roast starts after the button showed', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    await h.service.check();
    h.setRoasting(true);
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'roasting' } });
    h.setRoasting(false);
    expect(h.service.restart()).toEqual({ ok: true, value: undefined });
    expect(h.updater.quitAndInstall).toHaveBeenCalledTimes(1);
    expect(h.events()).toContain('update.restarting');
  });

  it('restart with nothing ready is refused', async () => {
    const h = updateHarness();
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'not-ready' } });
    h.latest(h.fail());
    await h.service.check();
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'not-ready' } });
    expect(h.updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('an installer that will not start is logged, and the update stays ready', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    await h.service.check();
    h.updater.quitAndInstall.mockImplementation(() => {
      throw new Error('spawn EACCES');
    });
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'install-failed' } });
    expect(h.service.status).toEqual({ state: 'ready', version: '0.2.0' });
    expect(h.logs.find((e) => e.event === 'update.install-failed')).toMatchObject({
      level: 'error',
      context: { error: { message: 'spawn EACCES' } },
    });
  });
});

describe('UpdateService: macOS unsigned (cannot install)', () => {
  it('a newer version is announced, never downloaded', async () => {
    const h = updateHarness({ canInstall: false });
    h.latest(ok('0.2.0'));
    await h.service.check();
    expect(h.service.status).toEqual({
      state: 'available',
      version: '0.2.0',
      reason: 'cant-replace',
    });
    expect(h.updater.download).not.toHaveBeenCalled();
    expect(h.events()).toEqual(['update.available']);
  });

  it('the same version found again does not flicker or log twice', async () => {
    const h = updateHarness({ canInstall: false });
    h.latest(ok('0.2.0'), ok('0.2.0'));
    await h.service.check();
    await h.service.check();
    expect(h.statuses).toEqual([
      { state: 'checking' },
      { state: 'available', version: '0.2.0', reason: 'cant-replace' },
    ]);
    expect(h.events()).toEqual(['update.available']);
  });

  it('a still newer version replaces the one shown', async () => {
    const h = updateHarness({ canInstall: false });
    h.latest(ok('0.2.0'), ok('0.3.0'));
    await h.service.check();
    await h.service.check();
    expect(h.service.status).toEqual({
      state: 'available',
      version: '0.3.0',
      reason: 'cant-replace',
    });
    expect(h.events()).toEqual(['update.available', 'update.available']);
  });

  it('a failed daily check keeps the version that is out on screen', async () => {
    const h = updateHarness({ canInstall: false });
    h.latest(ok('0.2.0'), h.fail());
    await h.service.check();
    await h.service.check();
    expect(h.service.status).toEqual({
      state: 'available',
      version: '0.2.0',
      reason: 'cant-replace',
    });
    expect(h.events()).toContain('update.check-failed');
  });

  it('a downloaded event changes nothing, and restart never installs', async () => {
    const h = updateHarness({ canInstall: false });
    h.latest(ok('0.2.0'));
    await h.service.check();
    h.emit({ kind: 'downloaded', version: '0.2.0' });
    expect(h.service.status).toEqual({
      state: 'available',
      version: '0.2.0',
      reason: 'cant-replace',
    });
    expect(h.events()).toContain('update.downloaded-ignored');
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'not-ready' } });
    expect(h.updater.download).not.toHaveBeenCalled();
    expect(h.updater.quitAndInstall).not.toHaveBeenCalled();
  });
});

describe('UpdateService: can it install is asked each time', () => {
  it('a copy moved into Applications downloads at the next check', async () => {
    const h = updateHarness({ canInstall: false });
    h.latest(ok('0.2.0'), ok('0.2.0'));
    await h.service.check();
    expect(h.service.status).toEqual({
      state: 'available',
      version: '0.2.0',
      reason: 'cant-replace',
    });
    h.setCanInstall(true);
    await h.service.check();
    expect(h.service.status).toEqual({ state: 'ready', version: '0.2.0' });
    expect(h.updater.download).toHaveBeenCalledTimes(1);
  });

  it('a copy that can no longer replace itself never restarts into the installer', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    await h.service.check();
    h.setCanInstall(false);
    expect(h.service.restart()).toEqual({ ok: false, error: { kind: 'not-ready' } });
    expect(h.updater.quitAndInstall).not.toHaveBeenCalled();
  });
});

describe('UpdateService: the last install failed', () => {
  const FAILED = { version: '0.2.0', reason: 'mv failed' };

  it('shows failed at the install step and logs it once', () => {
    const h = updateHarness();
    h.service.installFailed(FAILED);
    h.service.installFailed(FAILED);
    expect(h.service.status).toEqual({ state: 'failed', stage: 'install' });
    expect(h.statuses).toEqual([{ state: 'failed', stage: 'install' }]);
    expect(h.logs.filter((e) => e.event === 'update.last-install-failed')).toEqual([
      expect.objectContaining({ level: 'warn', context: FAILED }),
    ]);
  });

  it('stays on screen until the first check, which downloads it again', async () => {
    const h = updateHarness();
    h.latest(ok('0.2.0'));
    h.service.installFailed(FAILED);
    h.service.start();
    await h.clock.runFor(FIRST_CHECK_MS - 1);
    expect(h.service.status).toEqual({ state: 'failed', stage: 'install' });
    await h.clock.runFor(1);
    expect(h.service.status).toEqual({ state: 'ready', version: '0.2.0' });
  });

  it('arriving after a check has begun, or after dispose, changes nothing', async () => {
    const h = updateHarness();
    await h.service.check();
    h.service.installFailed(FAILED);
    expect(h.service.status).toMatchObject({ state: 'idle' });
    const late = updateHarness();
    late.service.dispose();
    late.service.installFailed(FAILED);
    expect(late.statuses).toEqual([]);
  });
});
