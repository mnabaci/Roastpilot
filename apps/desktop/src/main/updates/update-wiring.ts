import {
  serializeError,
  UpdateService,
  type Clock,
  type Logger,
  type Updater,
} from '@roastpilot/core';
import {
  err,
  UPDATES_OFF,
  type AppInfo,
  type OpenReleasePageError,
  type ReleasePage,
  type RestartToUpdateError,
  type Result,
  type UpdateStatus,
} from '@roastpilot/shared';
import { adaptUpdater, type AppUpdaterLike } from './electron-updater-adapter';
import type { MacEnvironment } from './mac/mac-environment';
import { createMacInstaller } from './mac/mac-installer';
import { openReleasePage } from './release-page';

/** What main does with updates: About's calls, and the computer waking up. */
export interface Updates {
  info(): AppInfo;
  check(): Promise<void>;
  restart(): Result<void, RestartToUpdateError>;
  openReleasePage(page: ReleasePage): Promise<Result<void, OpenReleasePageError>>;
  /** The computer woke up: a check if a day has passed. */
  wake(): void;
  /** A quit step after the safe stop: on macOS starts the installer if an update is ready. */
  installOnQuit(): void;
}

export interface UpdatesDeps {
  /** `app.isPackaged`: the updater is off in development. */
  packaged: boolean;
  platform: NodeJS.Platform;
  version: string;
  /** electron-updater's autoUpdater; only touched when packaged. */
  updater: () => AppUpdaterLike;
  clock: Clock;
  wallNowMs: () => number;
  isRoasting: () => boolean;
  publish: (status: UpdateStatus) => void;
  /** The quit guard's shutdown, then `finish` instead of quitting (Restart to update). */
  shutdownThen: (finish: () => void) => void;
  quit: () => void;
  openExternal: (url: string) => Promise<void>;
  /** macOS: where our own installer works; only asked when packaged on a Mac. */
  mac: () => MacEnvironment;
  logger: Logger;
}

/** The platform's updater, and what only the Mac one does. */
interface PlatformUpdater {
  updater: Updater;
  canInstall: () => boolean;
  installOnQuit: () => void;
  /** macOS: tells the service when the last install failed. */
  afterStart: (service: UpdateService) => void;
}

function platformUpdater(deps: UpdatesDeps): PlatformUpdater {
  const { shutdownThen, quit, logger } = deps;
  if (deps.platform === 'darwin') {
    const mac = createMacInstaller({
      ...deps.mac(),
      autoUpdater: deps.updater(),
      shutdownThen,
      quit,
      logger,
    });
    return {
      updater: mac.updater,
      canInstall: () => mac.canInstall(),
      installOnQuit: () => {
        mac.installOnQuit();
      },
      afterStart: (service) => {
        mac.lastInstall
          .then((last) => {
            if (last?.ok === false) service.installFailed(last);
          })
          .catch((error: unknown) => {
            logger.error('update.install-log-failed', { error: serializeError(error) });
          });
      },
    };
  }
  // Windows: electron-updater downloads and installs on quit itself (ADR 0017).
  const canInstall = deps.platform === 'win32';
  return {
    updater: adaptUpdater(deps.updater(), { canInstall, shutdownThen, quit, logger }),
    canInstall: () => canInstall,
    installOnQuit: () => undefined,
    afterStart: () => undefined,
  };
}

/**
 * Updates as ADRs 0017 and 0018 set them: Windows through electron-updater, macOS through our own
 * installer, which falls back to announcing a newer version when the app can't replace itself.
 * Off in development. Checks start 10 s after this call.
 */
export function createUpdates(deps: UpdatesDeps): Updates {
  const { packaged, version, logger } = deps;
  const releasePage = (status: () => UpdateStatus) => (page: ReleasePage) =>
    openReleasePage(page, {
      installedVersion: version,
      status,
      openExternal: deps.openExternal,
      logger,
    });
  if (!packaged) {
    logger.info('update.off', { reason: 'development' });
    return {
      info: () => ({ version, update: UPDATES_OFF }),
      check: () => Promise.resolve(),
      restart: () => err({ kind: 'not-ready' }),
      openReleasePage: releasePage(() => UPDATES_OFF),
      wake: () => undefined,
      installOnQuit: () => undefined,
    };
  }
  const platformUpdates = platformUpdater(deps);
  const service = new UpdateService({
    updater: platformUpdates.updater,
    clock: deps.clock,
    wallNowMs: deps.wallNowMs,
    installedVersion: version,
    canInstall: platformUpdates.canInstall,
    isRoasting: deps.isRoasting,
    onStatus: deps.publish,
    logger,
  });
  platformUpdates.afterStart(service);
  service.start();
  return {
    info: () => ({ version, update: service.status }),
    check: () => service.check(),
    restart: () => service.restart(),
    openReleasePage: releasePage(() => service.status),
    wake: () => {
      service.wake();
    },
    installOnQuit: platformUpdates.installOnQuit,
  };
}
