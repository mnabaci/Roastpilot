import type { Logger } from '@roastpilot/core';
import { serializeError } from '@roastpilot/core';
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { WINDOW_BACKGROUND } from './window-background';

/**
 * The app icon (docs/spec/ui.md, Brand). Packaged builds get it from electron-builder; in
 * development the Dock and the Windows taskbar would show Electron's, so it is set by hand.
 */
export function devIcon(): string | undefined {
  return app.isPackaged ? undefined : join(app.getAppPath(), 'build', 'icon.png');
}

/** The one app window, locked down: sandboxed, no new windows, no navigating away. */
export function createMainWindow({
  icon,
  logger,
}: {
  icon: string | undefined;
  logger: Logger;
}): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Roastpilot',
    icon,
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
