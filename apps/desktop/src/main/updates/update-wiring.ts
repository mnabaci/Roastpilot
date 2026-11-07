import { UpdateService, type Clock, type Logger } from '@roastpilot/core';
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
import { openReleasePage } from './release-page';

/** What main does with updates: About's calls, and the computer waking up. */
export interface Updates {
  info(): AppInfo;
  check(): Promise<void>;
  restart(): Result<void, RestartToUpdateError>;
  openReleasePage(page: ReleasePage): Promise<Result<void, OpenReleasePageError>>;
  /** The computer woke up: a check if a day has passed. */
  wake(): void;
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
  logger: Logger;
}

/**
 * Updates as ADR 0017 sets them: Windows downloads and installs; unsigned macOS only announces a
 * newer version. Off in development. Checks start 10 s after this call.
 */
export function createUpdates(deps: UpdatesDeps): Updates {
  const { packaged, platform, version, logger } = deps;
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
    };
  }
  const canInstall = platform === 'win32';
  const service = new UpdateService({
    updater: adaptUpdater(deps.updater(), {
      canInstall,
      shutdownThen: deps.shutdownThen,
      quit: deps.quit,
      logger,
    }),
    clock: deps.clock,
    wallNowMs: deps.wallNowMs,
    installedVersion: version,
    canInstall: () => canInstall,
    isRoasting: deps.isRoasting,
    onStatus: deps.publish,
    logger,
  });
  service.start();
  return {
    info: () => ({ version, update: service.status }),
    check: () => service.check(),
    restart: () => service.restart(),
    openReleasePage: releasePage(() => service.status),
    wake: () => {
      service.wake();
    },
  };
}
