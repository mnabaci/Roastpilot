import type { Logger, ProfileRepository } from '@roastpilot/core';
import { listSerialPorts } from '@roastpilot/drivers';
import { dialog, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { AppServices } from './app-services-types';
import { openBeanLink } from './beans/open-bean-link';
import { makeBeanProfile } from './beans/make-bean-profile';
import { connectWiring } from './connect-wiring';
import { pathChoosers } from './files/file-dialogs';
import { createLibraryFileActions } from './files/library-file-actions';
import { createLibraryKinds } from './files/library-wiring';
import { createRoastFiles } from './history/roast-files';
import type { IpcDeps } from './ipc-deps';
import { listLogDays, readLogDay } from './logging/log-reader';
import { makeProfileFromRoast } from './profiles/make-profile';
import type { SimulatorBeans } from './simulator-beans';
import { systemClock } from './system-clock';
import type { Updates } from './updates/update-wiring';

/** The file you picked, as files/picked-file.ts reads and writes it. */
const pickedFiles = {
  readText: (path: string) => readFile(path, 'utf8'),
  writeText: (path: string, text: string) => writeFile(path, text, 'utf8'),
  sizeOf: async (path: string) => (await stat(path)).size,
  rename,
  remove: (path: string) => rm(path, { force: true }),
};

/** Everything the IPC handlers call, made from main's services (docs/spec/architecture.md). */
export function buildIpcDeps({
  services,
  profileStore,
  simulatorBeans,
  updates,
  logDir,
  openLogFolder,
  logger,
}: {
  services: AppServices;
  profileStore: ProfileRepository;
  simulatorBeans: SimulatorBeans;
  updates: Updates;
  logDir: string;
  openLogFolder: () => Promise<void>;
  logger: Logger;
}): IpcDeps {
  const { session, roast, history, profiles, roasters, beans } = services;
  const filesLogger = logger.child('files');
  const beansLogger = logger.child('beans');
  const newProfileId = () => `custom-${randomUUID()}`;
  // One file dialog at a time, whichever screen asks.
  const choosers = pathChoosers({ dialogs: dialog, now: () => new Date(), logger: filesLogger });
  return {
    session,
    roast,
    setOutputByHand: services.setOutputByHand,
    coach: services.coachActions,
    settings: services.settings,
    history,
    roastFiles: createRoastFiles({
      history,
      files: services.roastFiles,
      ...choosers,
      ...pickedFiles,
      logger: logger.child('history'),
    }),
    libraryFiles: createLibraryFileActions({
      kinds: createLibraryKinds({
        beans,
        profiles,
        profileStore,
        roasters,
        newProfileId,
        now: () => new Date(),
        logger: filesLogger,
      }),
      ...choosers,
      ...pickedFiles,
      logger: filesLogger,
    }),
    pilot: services.pilot,
    profiles,
    roasters,
    beans,
    makeProfile: (request) =>
      makeProfileFromRoast(request, {
        history,
        profiles,
        activeRoaster: () => roasters.active(),
        newId: newProfileId,
      }),
    makeBeanProfile: (request) =>
      makeBeanProfile(request, { beans, profiles, logger: beansLogger }),
    openBeanLink: (id) =>
      openBeanLink(id, {
        beans,
        openExternal: (url) => shell.openExternal(url),
        logger: beansLogger,
      }),
    nowMs: () => systemClock.now(),
    snapshot: services.snapshot,
    listPorts: () => listSerialPorts(),
    // Connect uses the active roaster (docs/spec/roasters.md): its model picks the driver.
    ...connectWiring({
      roasters,
      session,
      roast,
      attach: (driver) => simulatorBeans.attach(driver),
      clock: systemClock,
      logger,
    }),
    updates,
    logs: {
      listDays: () => listLogDays(logDir),
      readDay: (day) => readLogDay(logDir, day),
      openFolder: openLogFolder,
    },
  };
}
