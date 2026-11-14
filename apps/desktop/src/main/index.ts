// Composition root: wires core, drivers, logging and IPC (docs/spec/architecture.md).
// First: a development run may move the data folder before anything reads it.
import './user-data-override';
import { serializeError } from '@roastpilot/core';
import { IPC_CHANNELS } from '@roastpilot/shared';
import { app, BrowserWindow, powerMonitor, powerSaveBlocker } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { createAppServices } from './app-services';
import { SimulatorBeans } from './simulator-beans';
import { broadcast, registerIpcHandlers, registerIpcListener } from './ipc';
import { createIpcHandlers, handleRendererLog, withErrorLogging } from './ipc-handlers';
import { buildIpcDeps } from './ipc-wiring';
import { installAppMenu } from './install-app-menu';
import { appPage, createMainWindow, devIcon } from './main-window';
import { installWindowTheme } from './window-theme';
import { createPowerGuard } from './power-guard';
import { JsonSettingsStore } from './settings/json-settings-store';
import { startLogging } from './start-logging';
import { wireShutdown } from './shutdown-wiring';
import { openStores } from './storage-wiring';
import { systemClock, wallClock } from './system-clock';

const { logger, flush: flushLogs, logDir, openLogFolder } = startLogging();

// Saved data (docs/spec/data-model.md). Without a database the app still roasts; History says why.
// A database about to be migrated is backed up first (docs/spec/install-and-update.md).
const stores = openStores(
  join(app.getPath('userData'), 'roastpilot.db'),
  wallClock,
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

const services = createAppServices({
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

const { session, roast, recorder } = services;

const updates = wireShutdown({
  session,
  recorder,
  roastState: () => roast.state,
  closeDatabase: stores.close,
  flushLogs,
  logger,
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
    const deps = buildIpcDeps({
      services,
      profileStore: stores.profileStore,
      simulatorBeans,
      updates,
      logDir,
      openLogFolder,
      logger,
    });
    registerIpcHandlers(withErrorLogging(createIpcHandlers(deps), ipcLogger), senderCheck);
    const rendererLogger = logger.child('renderer');
    registerIpcListener(
      IPC_CHANNELS.log,
      (payload) => {
        handleRendererLog(payload, rendererLogger);
      },
      senderCheck,
    );
    installAppMenu({ openLogFolder, logger });
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
