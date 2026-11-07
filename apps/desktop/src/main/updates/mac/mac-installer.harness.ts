import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { AppUpdaterLike, ReleaseInfo } from '../electron-updater-adapter';
import { fakeCommands, type FakeMac } from './fake-commands.harness';
import type { MacEnvironment } from './mac-environment';
import type { DetachedChild } from './swap-helper';

export const ZIP_BYTES = Buffer.from('the zip of Roastpilot 0.2.0');
export const ZIP_SHA = createHash('sha512').update(ZIP_BYTES).digest('base64');
export const ZIP_URL =
  'https://github.com/mnabaci/Roastpilot/releases/download/v0.2.0/Roastpilot-0.2.0-arm64-mac.zip';
export const RELEASE: ReleaseInfo = {
  version: '0.2.0',
  files: [
    { url: 'Roastpilot-0.2.0-arm64.dmg', sha512: 'dmg==', size: 99 },
    { url: 'Roastpilot-0.2.0-arm64-mac.zip', sha512: ZIP_SHA, size: ZIP_BYTES.length },
  ],
};
export const EXE = '/Applications/Roastpilot.app/Contents/MacOS/Roastpilot';
export const HELPER = '/Applications/Roastpilot.app/Contents/Resources/mac-update-swap.sh';

/** electron-updater's autoUpdater: finds `release`, and must never download or install on a Mac. */
export function fakeAutoUpdater(release: ReleaseInfo = RELEASE) {
  return Object.assign(new EventEmitter(), {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: true,
    allowDowngrade: true,
    logger: null as AppUpdaterLike['logger'],
    checkForUpdates: vi.fn(() =>
      Promise.resolve<{ updateInfo: ReleaseInfo } | null>({ updateInfo: release }),
    ),
    downloadUpdate: vi.fn(() => Promise.resolve<unknown>([])),
    quitAndInstall: vi.fn(),
  });
}

/** GitHub answering with `bytes`, or failing the way a test says. */
export const fetchBytes = (bytes: Buffer = ZIP_BYTES) =>
  vi.fn((_url: string) => Promise.resolve(new Response(new Uint8Array(bytes))));

export interface MacEnvOptions extends FakeMac {
  exePath?: string;
  writable?: boolean;
  helperThere?: boolean;
  fetch?: MacEnvironment['fetch'];
}

/** A Mac on a temp folder: real files for the download, fake ditto/codesign/spawn. */
export async function fakeMacEnvironment(options: MacEnvOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'rp-mac-'));
  const children: {
    args: readonly string[];
    child: DetachedChild & { fail: (e: Error) => void };
  }[] = [];
  const spawn = vi.fn((_command: string, args: readonly string[]) => {
    let onError: ((error: Error) => void) | undefined;
    const child = {
      on: (_event: 'error', listener: (error: Error) => void) => {
        onError = listener;
      },
      unref: vi.fn(),
      fail: (error: Error) => onError?.(error),
    };
    children.push({ args, child });
    return child;
  });
  const env: MacEnvironment = {
    updatesDir: join(root, 'updates'),
    exePath: options.exePath ?? EXE,
    helperScript: HELPER,
    pid: 4242,
    arch: 'arm64',
    fetch: options.fetch ?? fetchBytes(),
    run: fakeCommands(options),
    spawn,
    canWrite: () => options.writable ?? true,
    fileExists: (file) => file === HELPER && (options.helperThere ?? true),
  };
  const entries: LogEntry[] = [];
  return {
    root,
    env,
    spawn,
    children,
    entries,
    logger: createLogger({ write: (e) => entries.push(e) }, 'updates'),
    events: () => entries.map((e) => e.event),
  };
}
