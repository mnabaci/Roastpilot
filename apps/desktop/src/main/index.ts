// Composition root: wires core, drivers, logging and IPC (docs/spec/architecture.md).
// First: a development run may move the data folder before anything reads it.
import { userDataChoice } from './user-data-override';
import { serializeError } from '@roastpilot/core';
import { listSerialPorts } from '@roastpilot/drivers';
import { IPC_CHANNELS, isRoastRunning } from '@roastpilot/shared';
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  powerMonitor,
  powerSaveBlocker,
  shell,
  systemPreferences,
} from 'electron';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAppMenu, hideMacEditExtras } from './app-menu';
import { createAppServices } from './app-services';
import { installCrashHandlers } from './crash-handlers';
import { createDriver } from './driver-factory';
import { SimulatorBeans } from './simulator-beans';
import { createRoastFiles } from './history/roast-files';
import { broadcast, registerIpcHandlers, registerIpcListener } from './ipc';
import { createIpcHandlers, handleRendererLog, withErrorLogging } from './ipc-handlers';
import { appPage, createMainWindow, devIcon } from './main-window';
import { installWindowTheme } from './window-theme';
import { createAppLogger } from './logging/app-logger';
import { listLogDays, readLogDay } from './logging/log-reader';
import { pruneOldLogsLater } from './logging/prune';
import { makeProfileFromRoast } from './profiles/make-profile';
import { pathChoosers } from './files/file-dialogs';
import { createLibraryFileActions } from './files/library-file-actions';
import { createLibraryKinds } from './files/library-wiring';
import { makeBeanProfile } from './beans/make-bean-profile';
import { createPowerGuard } from './power-guard';
import { createQuitGuard } from './quit-guard';
import { JsonSettingsStore } from './settings/json-settings-store';
import { openStores } from './storage-wiring';
import { systemClock } from './system-clock';
import electronUpdater from 'electron-updater';
import { macEnvironment } from './updates/mac/mac-environment';
import { createUpdates } from './updates/update-wiring';

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
if (userDataChoice.kind === 'override') {
  logger.info('app.user-data-override', { dir: userDataChoice.dir });
} else if (userDataChoice.kind === 'ignored') {
  logger.warn('app.user-data-override-ignored', {
    reason: userDataChoice.reason,
    value: userDataChoice.value,
  });
}
pruneOldLogsLater(logDir, logger);

async function openLogFolder(): Promise<void> {
  // openPath resolves with an error message, or '' when it worked.
  const failure = await shell.openPath(logDir);
  if (failure) throw new Error(`Couldn't open the log folder: ${failure}`);
}

// Saved data (docs/spec/data-model.md). Without a database the app still roasts; History says why.
// A database about to be migrated is backed up first (docs/spec/install-and-update.md).
const stores = openStores(
  join(app.getPath('userData'), 'roastpilot.db'),
  systemClock,
  logger.child('storage'),
  { dir: join(app.getPath('userData'), 'backups'), appVersion: app.getVersion(), now: new Date() },
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
// The Theme setting: Electron's theme and the window colour (docs/spec/ui.md, Settings).
const applyTheme = installWindowTheme();

const {
  session,
  roast,
  settings,
  history,
  roastFiles: roastFileService,
  recorder,
  pilot,
  coachActions,
  setOutputByHand,
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
  onSettingsChange: (latest) => {
    applyTheme(latest.theme);
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
const quitGuard = createQuitGuard({
  logger,
  steps: [
    { name: 'safe-stop', run: stopRoaster },
    { name: 'save-roast', run: saveRoast },
    { name: 'close-database', run: stores.close },
    // macOS: starts the installer once the app is shut down, if an update is ready (ADR 0018).
    // Before the logs are flushed, so a helper that won't start is in the log.
    {
      name: 'install-update',
      run: () => {
        updates.installOnQuit();
      },
    },
    { name: 'flush-logs', run: flushLogs },
  ],
  quit: () => {
    app.quit();
  },
});
app.on('before-quit', quitGuard);

// Updates never touch a roast: Restart to update waits for it to end (ADRs 0017, 0018).
const updates = createUpdates({
  packaged: app.isPackaged,
  platform: process.platform,
  version: app.getVersion(),
  updater: () => electronUpdater.autoUpdater,
  clock: systemClock,
  wallNowMs: () => Date.now(),
  isRoasting: () => isRoastRunning(roast.state),
  publish: (status) => {
    broadcast(IPC_CHANNELS.updateStatus, status);
  },
  // Restart to update: the same shutdown as quitting, then the installer (docs/spec/safety.md).
  shutdownThen: (finish) => {
    quitGuard.shutdownThen(finish);
  },
  quit: () => {
    app.quit();
  },
  openExternal: (url) => shell.openExternal(url),
  mac: macEnvironment,
  logger: logger.child('updates'),
});

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
    const filesLogger = logger.child('files');
    // One file dialog at a time, whichever screen asks.
    const choosers = pathChoosers({ dialogs: dialog, now: () => new Date(), logger: filesLogger });
    const readText = (path: string) => readFile(path, 'utf8');
    const writeText = (path: string, text: string) => writeFile(path, text, 'utf8');
    registerIpcHandlers(
      withErrorLogging(
        createIpcHandlers({
          session,
          roast,
          setOutputByHand,
          coach: coachActions,
          settings,
          history,
          roastFiles: createRoastFiles({
            history,
            files: roastFileService,
            ...choosers,
            readText,
            writeText,
            logger: historyLogger,
          }),
          libraryFiles: createLibraryFileActions({
            kinds: createLibraryKinds({
              beans,
              profiles,
              profileStore: stores.profileStore,
              roasters,
              newProfileId: () => `custom-${randomUUID()}`,
              now: () => new Date(),
              logger: filesLogger,
            }),
            ...choosers,
            readText,
            writeText,
            logger: filesLogger,
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
          updates,
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
    // macOS adds Dictation, Emoji & Symbols and AutoFill to any Edit menu; read when it builds one.
    if (process.platform === 'darwin') {
      hideMacEditExtras((key, type, value) => {
        systemPreferences.setUserDefault(key, type, value);
      });
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        buildAppMenu({
          appName: app.name,
          platform: process.platform,
          dev: !app.isPackaged,
          navigate: (screen) => {
            broadcast(IPC_CHANNELS.navigate, screen);
          },
          showSafetyNotice: () => {
            broadcast(IPC_CHANNELS.showSafetyNotice, null);
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
      updates.wake();
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
