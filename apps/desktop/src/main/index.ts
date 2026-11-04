// Composition root: wires core, drivers, logging and IPC (docs/spec/architecture.md).
import { serializeError } from '@roastpilot/core';
import { listSerialPorts } from '@roastpilot/drivers';
import { IPC_CHANNELS } from '@roastpilot/shared';
import { app, BrowserWindow, Menu, shell } from 'electron';
import { join } from 'node:path';
import { buildAppMenu } from './app-menu';
import { createAppServices } from './app-services';
import { installCrashHandlers } from './crash-handlers';
import { createDriver } from './driver-factory';
import { broadcast, registerIpcHandlers, registerIpcListener } from './ipc';
import { createIpcHandlers, handleRendererLog, withErrorLogging } from './ipc-handlers';
import { createAppLogger } from './logging/app-logger';
import { listLogDays, readLogDay } from './logging/log-reader';
import { pruneOldLogsLater } from './logging/prune';
import { createQuitGuard } from './quit-guard';
import { JsonSettingsStore } from './settings/json-settings-store';
import { systemClock } from './system-clock';
import { WINDOW_BACKGROUND } from './window-background';

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

const { session, roast, settings, snapshot } = createAppServices({
  clock: systemClock,
  logger,
  settingsStore: new JsonSettingsStore(join(app.getPath('userData'), 'settings.json'), {
    logger: logger.child('settings'),
  }),
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
      await logs.flush();
    },
    quit: () => {
      app.quit();
    },
  }),
);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Roastpilot',
    backgroundColor: WINDOW_BACKGROUND,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;

  // Never open new windows or navigate away from the app's own pages.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!devUrl || !url.startsWith(devUrl)) {
      logger.warn('window.navigation-blocked', { url });
      event.preventDefault();
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error('window.renderer-gone', { reason: details.reason, exitCode: details.exitCode });
  });

  const loaded = devUrl
    ? win.loadURL(devUrl)
    : win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  loaded.catch((error: unknown) => {
    logger.error('window.load-failed', { error: serializeError(error) });
  });
}

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
          snapshot,
          listPorts: () => listSerialPorts(),
          createDriver: (target) => createDriver(target, systemClock, logger.child('driver')),
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
