// Composition root: wires core, drivers, logging and IPC (docs/spec/architecture.md).
import { serializeError } from '@roastpilot/core';
import { listSerialPorts } from '@roastpilot/drivers';
import { drizzleOn, openDatabase, SqliteRoastRepository } from '@roastpilot/storage';
import { IPC_CHANNELS } from '@roastpilot/shared';
import { app, BrowserWindow, Menu, powerMonitor, powerSaveBlocker, shell } from 'electron';
import { join } from 'node:path';
import { buildAppMenu } from './app-menu';
import { createAppServices } from './app-services';
import { installCrashHandlers } from './crash-handlers';
import { createDriver } from './driver-factory';
import { SimulatorBeans } from './simulator-beans';
import { unavailableRepository } from './history/unavailable-repository';
import { broadcast, registerIpcHandlers, registerIpcListener } from './ipc';
import { createIpcHandlers, handleRendererLog, withErrorLogging } from './ipc-handlers';
import { createMainWindow, devIcon } from './main-window';
import { createAppLogger } from './logging/app-logger';
import { listLogDays, readLogDay } from './logging/log-reader';
import { pruneOldLogsLater } from './logging/prune';
import { createPowerGuard } from './power-guard';
import { createQuitGuard } from './quit-guard';
import { JsonSettingsStore } from './settings/json-settings-store';
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

// Saved roasts (docs/spec/data-model.md). Without a database the app still roasts; History says why.
const storageLogger = logger.child('storage');
const database = openDatabase(join(app.getPath('userData'), 'roastpilot.db'), storageLogger);
const roasts = database.ok
  ? new SqliteRoastRepository(drizzleOn(database.value), storageLogger)
  : unavailableRepository(
      database.error.kind === 'storage-failed' ? database.error.message : 'unavailable',
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

const { session, roast, settings, history, recorder, snapshot } = createAppServices({
  clock: systemClock,
  logger,
  settingsStore: new JsonSettingsStore(join(app.getPath('userData'), 'settings.json'), {
    logger: logger.child('settings'),
  }),
  roasts,
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

installCrashHandlers({
  process,
  logger,
  stopRoaster: () => session.disconnect(),
  emergencyStop: () => {
    session.emergencyStop();
  },
  flushLogs: () => logs.flush(),
  exit: (code) => {
    app.exit(code);
  },
});

// Safe stop before anything else on quit (docs/spec/safety.md).
app.on(
  'before-quit',
  createQuitGuard({
    logger,
    stop: async () => {
      await session.disconnect();
      await recorder.flush();
      if (database.ok) database.value.close();
      await logs.flush();
    },
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
    registerIpcHandlers(
      withErrorLogging(
        createIpcHandlers({
          session,
          roast,
          settings,
          history,
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
    );
    const rendererLogger = logger.child('renderer');
    registerIpcListener(IPC_CHANNELS.log, (payload) => {
      handleRendererLog(payload, rendererLogger);
    });
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
