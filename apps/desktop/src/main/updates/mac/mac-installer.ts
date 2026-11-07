import { serializeError, type Logger, type Updater, type UpdaterEvent } from '@roastpilot/core';
import { err, ok, type Result } from '@roastpilot/shared';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  errorMessage,
  quietUpdater,
  type AppUpdaterLike,
  type ReleaseInfo,
} from '../electron-updater-adapter';
import { appBundlePath, cantReplaceReason, type CantReplaceReason } from './app-bundle';
import { downloadZip, type DownloadDeps } from './download-zip';
import { clearUpdates, INSTALL_LOG, takeLastInstall, type LastInstall } from './install-log';
import { releaseZip } from './release-zip';
import type { RunCommand, StepFailure } from './run-command';
import { startSwapHelper, type SpawnDetached } from './swap-helper';
import { unpackApp } from './unpack-app';

export interface MacInstallerDeps {
  /** electron-updater: only asked what the latest release is (it reads `latest-mac.yml`). */
  autoUpdater: AppUpdaterLike;
  /** `<userData>/updates`: the download, the app staged for install, the helper's log. */
  updatesDir: string;
  /** `app.getPath('exe')`: the bundle around it is what gets replaced. */
  exePath: string;
  /** resources/mac-update-swap.sh inside the app. */
  helperScript: string;
  pid: number;
  arch: string;
  fetch: DownloadDeps['fetch'];
  run: RunCommand;
  spawn: SpawnDetached;
  canWrite: (dir: string) => boolean;
  fileExists: (file: string) => boolean;
  /** The quit guard's shutdown (safe stop, save, close, the install step), then `finish`. */
  shutdownThen: (finish: () => void) => void;
  quit: () => void;
  logger: Logger;
}

/** Roastpilot's own Mac installer (ADR 0018), behind the core `Updater`. */
export interface MacInstaller {
  updater: Updater;
  /** Whether this copy can replace itself; asked at each check. */
  canInstall(): boolean;
  /** A quit step, after the safe stop: starts the swap helper if an update is ready. */
  installOnQuit(): void;
  /** How the install of the last run went, read once at launch; never rejects. */
  lastInstall: Promise<LastInstall | undefined>;
}

/** A Mac update checked and unpacked, waiting for the app to quit. */
interface Staged {
  version: string;
  app: string;
}

/**
 * Downloads the release zip, checks it, and swaps the app after quitting
 * (docs/spec/install-and-update.md, Mac installer). electron-updater never downloads or installs
 * here: its Mac path needs a Developer ID signature.
 */
export function createMacInstaller(deps: MacInstallerDeps): MacInstaller {
  const { autoUpdater, updatesDir, logger } = deps;
  quietUpdater(autoUpdater, { installOnQuit: false, logger });
  const listeners = new Set<(event: UpdaterEvent) => void>();
  let found: ReleaseInfo | undefined;
  let staged: Staged | undefined;
  let relaunch = false;
  let started = false;
  let cantReplace: CantReplaceReason | undefined | null = null;

  // Leftovers of an earlier run (a download cut off by quitting, an app never installed) go first.
  const lastInstall = takeLastInstall(updatesDir, logger)
    .then(async (last) => {
      await clearUpdates(updatesDir);
      return last;
    })
    .catch((error: unknown) => {
      logger.warn('update.cleanup-failed', { error: serializeError(error) });
      return undefined;
    });

  const verifyFailed = (version: string, failure: StepFailure) => {
    logger.warn('update.verify-failed', { version, error: failure.message });
    return err(failure);
  };

  const fetchAndCheck = async (release: ReleaseInfo): Promise<Result<Staged, StepFailure>> => {
    const { version } = release;
    const zip = releaseZip(version, release.files ?? [], deps.arch);
    if (!zip.ok) return verifyFailed(version, zip.error);
    await clearUpdates(updatesDir);
    await mkdir(updatesDir, { recursive: true });
    const zipFile = join(updatesDir, `Roastpilot-${version}.zip`);
    const got = await downloadZip(zip.value, zipFile, {
      fetch: deps.fetch,
      onProgress: (percent) => {
        for (const listener of listeners) listener({ kind: 'progress', percent });
      },
    });
    if (!got.ok)
      return got.error.kind === 'verify' ? verifyFailed(version, got.error) : err(got.error);
    const dir = join(updatesDir, version);
    const app = await unpackApp(zipFile, dir, version, deps.run);
    await rm(zipFile, { force: true });
    if (app.ok) return ok({ version, app: app.value });
    await rm(dir, { recursive: true, force: true });
    return verifyFailed(version, app.error);
  };

  const updater: Updater = {
    async latestVersion() {
      try {
        const result = await autoUpdater.checkForUpdates();
        if (!result) return err({ message: 'The updater is off.' });
        found = result.updateInfo;
        return ok(found.version);
      } catch (error) {
        return err({ message: errorMessage(error) });
      }
    },
    async download() {
      await lastInstall;
      if (found === undefined) return err({ message: 'No release found yet' });
      try {
        const result = await fetchAndCheck(found);
        if (!result.ok) return result;
        staged = result.value;
        logger.info('update.staged', { version: staged.version });
        return ok(undefined);
      } catch (error) {
        // A disk that fails outside the download (mkdir, rm): nothing half-done is kept.
        await clearUpdates(updatesDir).catch((cleanup: unknown) => {
          logger.warn('update.cleanup-failed', { error: serializeError(cleanup) });
        });
        return err({ message: errorMessage(error) });
      }
    },
    quitAndInstall() {
      // Thrown, not quit: UpdateService says "Couldn't start the update" and stays ready.
      if (staged === undefined) throw new Error('No update is ready to install');
      if (!deps.fileExists(deps.helperScript))
        throw new Error(`The update helper is missing: ${deps.helperScript}`);
      relaunch = true;
      // The install step runs inside the shutdown, after the safe stop (docs/spec/safety.md).
      deps.shutdownThen(deps.quit);
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    updater,
    lastInstall,
    canInstall() {
      const reason = cantReplaceReason(appBundlePath(deps.exePath), deps.canWrite);
      if (reason !== cantReplace && reason !== undefined)
        logger.info('update.cant-replace', { reason, exe: deps.exePath });
      cantReplace = reason;
      return reason === undefined;
    },
    installOnQuit() {
      if (staged === undefined || started) return;
      started = true;
      const installed = appBundlePath(deps.exePath);
      if (installed === undefined) {
        logger.error('update.install-start-failed', { error: 'Not running from an app bundle' });
        return;
      }
      logger.info('update.installing', { version: staged.version, relaunch });
      const onError = (error: Error) => {
        logger.error('update.install-start-failed', { error: serializeError(error) });
      };
      const request = {
        pid: deps.pid,
        installed,
        staged: staged.app,
        relaunch,
        log: join(updatesDir, INSTALL_LOG),
      };
      const result = startSwapHelper(deps.helperScript, request, deps.spawn, onError);
      if (!result.ok) onError(new Error(result.error.message));
    },
  };
}
