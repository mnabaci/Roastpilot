// Composition root: wires core, drivers, logging and IPC (docs/spec/architecture.md).
import { serializeError } from '@roastpilot/core';
import { listSerialPorts } from '@roastpilot/drivers';
import { IPC_CHANNELS } from '@roastpilot/shared';
import { app, BrowserWindow, dialog, Menu, powerMonitor, powerSaveBlocker, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAppMenu } from './app-menu';
import { createAppServices } from './app-services';
import { installCrashHandlers } from './crash-handlers';
import { createDriver } from './driver-factory';
import { SimulatorBeans } from './simulator-beans';
import { createRoastFiles } from './history/roast-files';
import { broadcast, registerIpcHandlers, registerIpcListener } from './ipc';
import { createIpcHandlers, handleRendererLog, withErrorLogging } from './ipc-handlers';
import { appPage, createMainWindow, devIcon } from './main-window';
import { createAppLogger } from './logging/app-logger';
import { listLogDays, readLogDay } from './logging/log-reader';
import { pruneOldLogsLater } from './logging/prune';
import { makeProfileFromRoast } from './profiles/make-profile';
import { pathChoosers } from './history/roast-file-dialogs';
import { makeBeanProfile } from './beans/make-bean-profile';
import { createPowerGuard } from './power-guard';
import { createQuitGuard } from './quit-guard';
import { JsonSettingsStore } from './settings/json-settings-store';
import { openStores } from './storage-wiring';
import { systemClock } from './system-clock';

const logDir = app.getPath('logs');
const logs = createAppLogger({
  dir: logDir,
  dev: !app.isPackaged,
  publish: (records) => {
    broadcast(IPC_CHANNELS.logEntries, records);
  },
});
const logger = logs.logger;
logger.info('app.started', {
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
});
pruneOldLogsLater(logDir, logger);

async function openLogFolder(): Promise<void> {
  // openPath resolves with an error message, or '' when it worked.
  const failure = await shell.openPath(logDir);
  if (failure) throw new Error(`Couldn't open the log folder: ${failure}`);
}

// Saved data (docs/spec/data-model.md). Without a database the app still roasts; History says why.
const stores = openStores(
  join(app.getPath('userData'), 'roastpilot.db'),
  systemClock,
  logger.child('storage'),
);

// Asleep, nothing watches the roaster: stay awake while one is connected, and keep the screen on
// during a roast (docs/spec/safety.md).
const power = createPowerGuard({
  blocker: powerSaveBlocker,
  emergencyStop: (rule) => {
    session.emergencyStop(rule);
  },
  logger: logger.child('power'),
});

const simulatorBeans = new SimulatorBeans();

const {
  session,
  roast,
  settings,
  history,
  roastFiles: roastFileService,
  recorder,
  pilot,
  profiles,
  roasters,
  beans,
  snapshot,
} = createAppServices({
  clock: systemClock,
  logger,
  settingsStore: new JsonSettingsStore(join(app.getPath('userData'), 'settings.json'), {
    logger: logger.child('settings'),
  }),
  roasts: stores.roasts,
  profileStore: stores.profileStore,
  roasterStore: stores.roasterStore,
  beanStore: stores.beanStore,
  newProfileId: () => `custom-${randomUUID()}`,
  nowIso: () => new Date().toISOString(),
  onConnectionChange: (state) => {
    power.onConnection(state);
  },
  onRoastChange: (state) => {
    power.onRoast(state);
    simulatorBeans.onRoast(state);
  },
  publish: broadcast,
});

// Shared by quit and crash, in this order: safe stop first, then saving, logs last.
const stopRoaster = () => session.disconnect();
const saveRoast = () => recorder.flush();
const flushLogs = () => logs.flush();

installCrashHandlers({
  process,
  logger,
  stopRoaster,
  emergencyStop: () => {
    session.emergencyStop();
  },
  saveRoast,
  flushLogs,
  exit: (code) => {
    app.exit(code);
  },
});

// Safe stop before anything else on quit (docs/spec/safety.md).
app.on(
  'before-quit',
  createQuitGuard({
    logger,
    steps: [
      { name: 'safe-stop', run: stopRoaster },
      { name: 'save-roast', run: saveRoast },
      { name: 'close-database', run: stores.close },
      { name: 'flush-logs', run: flushLogs },
    ],
    quit: () => {
      app.quit();
    },
  }),
);

const DEV_ICON = devIcon();
const createWindow = () => {
  createMainWindow({ icon: DEV_ICON, logger });
};

app
  .whenReady()
  .then(() => {
    const ipcLogger = logger.child('ipc');
    // Only the app's own page, in one of its windows, may call main (docs/spec/architecture.md).
    const senderCheck = { page: appPage(), logger: ipcLogger };
    const historyLogger = logger.child('history');
    registerIpcHandlers(
      withErrorLogging(
        createIpcHandlers({
          session,
          roast,
          settings,
          history,
          roastFiles: createRoastFiles({
            history,
            files: roastFileService,
            ...pathChoosers({ dialogs: dialog, now: () => new Date(), logger: historyLogger }),
            readText: (path) => readFile(path, 'utf8'),
            writeText: (path, text) => writeFile(path, text, 'utf8'),
            logger: historyLogger,
          }),
          pilot,
          profiles,
          roasters,
          beans,
          makeProfile: (request) =>
            makeProfileFromRoast(request, {
              history,
              profiles,
              activeRoaster: () => roasters.active(),
              newId: () => `custom-${randomUUID()}`,
            }),
          makeBeanProfile: (request) =>
            makeBeanProfile(request, { beans, profiles, logger: logger.child('beans') }),
          nowMs: () => systemClock.now(),
          snapshot,
          listPorts: () => listSerialPorts(),
          createDriver: (target) =>
            simulatorBeans.attach(createDriver(target, systemClock, logger.child('driver'))),
          logs: {
            listDays: () => listLogDays(logDir),
            readDay: (day) => readLogDay(logDir, day),
            openFolder: openLogFolder,
          },
        }),
        ipcLogger,
      ),
      senderCheck,
    );
    const rendererLogger = logger.child('renderer');
    registerIpcListener(
      IPC_CHANNELS.log,
      (payload) => {
        handleRendererLog(payload, rendererLogger);
      },
      senderCheck,
    );
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        buildAppMenu({
          appName: app.name,
          platform: process.platform,
          dev: !app.isPackaged,
          navigate: (screen) => {
            broadcast(IPC_CHANNELS.navigate, screen);
          },
          openLogFolder: () => {
            openLogFolder().catch((error: unknown) => {
              logger.error('menu.open-log-folder-failed', { error: serializeError(error) });
            });
          },
        }),
      ),
    );
    powerMonitor.on('suspend', () => {
      power.onSuspend();
    });
    powerMonitor.on('resume', () => {
      power.onResume();
    });
    if (DEV_ICON) app.dock?.setIcon(DEV_ICON);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error: unknown) => {
    logger.error('app.start-failed', { error: serializeError(error) });
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
