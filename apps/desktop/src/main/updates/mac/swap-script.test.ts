import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseInstallLog } from './install-log';

/** The real helper that ships in the app (electron-builder.yml extraResources). */
const SCRIPT = join(import.meta.dirname, '..', '..', '..', '..', 'resources', 'mac-update-swap.sh');

let root: string;
let installed: string;
let staged: string;
let log: string;
let bin: string;
let opened: string;
const sleepers: ChildProcess[] = [];

/** A fake .app: a folder with a file saying which version it is. */
async function fakeApp(path: string, version: string) {
  await mkdir(join(path, 'Contents'), { recursive: true });
  await writeFile(join(path, 'Contents', 'version'), version);
}

const versionAt = (path: string) => readFile(join(path, 'Contents', 'version'), 'utf8');

/** A process that lives for `seconds`: the app the helper waits for. */
function dummyApp(seconds: number): number {
  const child = spawn('/bin/sleep', [String(seconds)], { stdio: 'ignore' });
  sleepers.push(child);
  if (child.pid === undefined) throw new Error('sleep did not start');
  return child.pid;
}

/** Runs the helper, with a fake `open` first on PATH; resolves with its exit code. */
function swap(pid: number, relaunch: '0' | '1', waitSeconds = '5', stagedPath = staged) {
  return new Promise<number>((resolve) => {
    execFile(
      '/bin/sh',
      [SCRIPT, String(pid), installed, stagedPath, relaunch, log, waitSeconds],
      { env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` } },
      (error) => {
        resolve(error ? Number(error.code ?? 1) : 0);
      },
    );
  });
}

const lastResult = async () => parseInstallLog(await readFile(log, 'utf8'));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'rp-swap-'));
  installed = join(root, 'Applications', 'Roastpilot.app');
  staged = join(root, 'updates', '0.2.0', 'Roastpilot.app');
  log = join(root, 'updates', 'install.log');
  bin = join(root, 'bin');
  opened = join(root, 'opened');
  await fakeApp(installed, '0.1.0');
  await fakeApp(staged, '0.2.0');
  await mkdir(bin);
  await writeFile(join(bin, 'open'), `#!/bin/sh\nprintf '%s\\n' "$@" > "${opened}"\n`);
  await chmod(join(bin, 'open'), 0o755);
});

afterEach(async () => {
  for (const child of sleepers.splice(0)) child.kill();
  await chmod(join(root, 'updates', '0.2.0'), 0o755).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

describe.skipIf(process.platform !== 'darwin')('mac-update-swap.sh', () => {
  it('waits for the app to quit, swaps the new version in and deletes the old one', async () => {
    const pid = dummyApp(0.4);
    expect(await swap(pid, '0')).toBe(0);
    expect(await versionAt(installed)).toBe('0.2.0');
    expect(existsSync(`${installed}.old`)).toBe(false);
    expect(existsSync(staged)).toBe(false);
    expect(existsSync(opened)).toBe(false);
    expect(await lastResult()).toEqual({ ok: true, version: '0.2.0' });
  });

  it('with relaunch, opens the new app after the swap', async () => {
    expect(await swap(dummyApp(0.1), '1')).toBe(0);
    expect(await readFile(opened, 'utf8')).toBe(`-n\n${installed}\n`);
    expect(await versionAt(installed)).toBe('0.2.0');
  });

  it('a leftover .old from an earlier swap is cleared first', async () => {
    await fakeApp(`${installed}.old`, '0.0.9');
    expect(await swap(dummyApp(0.1), '0')).toBe(0);
    expect(await versionAt(installed)).toBe('0.2.0');
    expect(existsSync(`${installed}.old`)).toBe(false);
  });

  it('the new app missing: nothing moves, the result says why', async () => {
    const missing = join(root, 'updates', '0.3.0', 'Roastpilot.app');
    expect(await swap(dummyApp(0.1), '1', '5', missing)).toBe(1);
    expect(await versionAt(installed)).toBe('0.1.0');
    expect(existsSync(opened)).toBe(false);
    expect(await lastResult()).toEqual({
      ok: false,
      version: '0.3.0',
      reason: `the new app is missing: ${missing}`,
    });
  });

  it('a move that fails half way puts the old app back', async () => {
    // The new app's folder is read-only: moving it out fails after the old app moved aside.
    await chmod(join(root, 'updates', '0.2.0'), 0o555);
    expect(await swap(dummyApp(0.1), '1')).toBe(1);
    expect(await versionAt(installed)).toBe('0.1.0');
    expect(existsSync(`${installed}.old`)).toBe(false);
    expect(existsSync(opened)).toBe(false);
    const text = await readFile(log, 'utf8');
    expect(text).toContain('rolled back');
    expect(await lastResult()).toEqual({
      ok: false,
      version: '0.2.0',
      reason: 'could not move the new app into place',
    });
  });

  it('an app that never quits: it gives up, nothing moved', async () => {
    const pid = dummyApp(30);
    expect(await swap(pid, '1', '1')).toBe(1);
    expect(await versionAt(installed)).toBe('0.1.0');
    expect(await versionAt(staged)).toBe('0.2.0');
    expect(await lastResult()).toMatchObject({
      ok: false,
      reason: 'the app did not quit within 1 s',
    });
  });

  it.each([
    ['a process id that is not a number', ['1; rm -rf /', '/A/R.app', '/s/R.app']],
    ['an installed path that is not an app', ['1', '/Applications', '/s/R.app']],
    ['a staged path that is not an app', ['1', '/A/R.app', '/s']],
  ])('refuses %s', async (_name, [pid = '', from = '', to = '']) => {
    const code = await new Promise<number>((resolve) => {
      execFile('/bin/sh', [SCRIPT, pid, from, to, '0', log, '1'], (error) => {
        resolve(error ? Number(error.code ?? 1) : 0);
      });
    });
    expect(code).toBe(1);
    expect(await versionAt(installed)).toBe('0.1.0');
    expect(await lastResult()).toMatchObject({ ok: false });
  });

  it('without its arguments it does nothing', async () => {
    const code = await new Promise<number>((resolve) => {
      execFile('/bin/sh', [SCRIPT, '1'], (error) => {
        resolve(error ? Number(error.code ?? 1) : 0);
      });
    });
    expect(code).toBe(2);
    expect(existsSync(log)).toBe(false);
  });
});
