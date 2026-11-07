import { app, net } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isWritable } from './app-bundle';
import type { MacInstallerDeps } from './mac-installer';
import { runCommand } from './run-command';
import { spawnDetached } from './swap-helper';

/** What the Mac installer needs from this process and Electron; the rest comes from the wiring. */
export type MacEnvironment = Omit<
  MacInstallerDeps,
  'autoUpdater' | 'shutdownThen' | 'quit' | 'logger'
>;

/** The real Mac: the user-data folder, the running bundle, Electron's fetch (system proxy). */
export function macEnvironment(): MacEnvironment {
  return {
    updatesDir: join(app.getPath('userData'), 'updates'),
    exePath: app.getPath('exe'),
    // electron-builder.yml extraResources puts it next to app.asar.
    helperScript: join(process.resourcesPath, 'mac-update-swap.sh'),
    pid: process.pid,
    arch: process.arch,
    fetch: (url) => net.fetch(url),
    run: runCommand,
    spawn: spawnDetached,
    canWrite: isWritable,
    fileExists: existsSync,
  };
}
