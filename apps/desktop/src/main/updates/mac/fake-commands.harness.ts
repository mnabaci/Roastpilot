import { err, ok } from '@roastpilot/shared';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { RunCommand } from './run-command';

export interface FakeMac {
  /** The apps `ditto` unpacks (names of folders it creates). */
  apps?: string[];
  bundleId?: string;
  version?: string;
  /** Programs that fail, by path (`/usr/bin/codesign`). */
  failing?: string[];
}

/** ditto, codesign and plutil as a Mac would answer them, on a real temp folder. */
export function fakeCommands({
  apps = ['Roastpilot.app'],
  bundleId = 'app.roastpilot.desktop',
  version = '0.2.0',
  failing = [],
}: FakeMac = {}) {
  const run = vi.fn<RunCommand>(async (file, args) => {
    if (failing.includes(file)) return err({ message: `${file} failed: no` });
    if (file === '/usr/bin/ditto') {
      const dir = args.at(-1) ?? '';
      for (const app of apps) await mkdir(join(dir, app, 'Contents'), { recursive: true });
    }
    if (file === '/usr/bin/plutil')
      return ok(`${args[1] === 'CFBundleIdentifier' ? bundleId : version}\n`);
    return ok('');
  });
  return run;
}
