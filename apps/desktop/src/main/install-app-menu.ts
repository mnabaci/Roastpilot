import { serializeError, type Logger } from '@roastpilot/core';
import { IPC_CHANNELS } from '@roastpilot/shared';
import { app, Menu, systemPreferences } from 'electron';
import { buildAppMenu, hideMacEditExtras } from './app-menu';
import { broadcast } from './ipc';

/** The app's menu bar (docs/spec/ui.md); its items talk to the window through broadcasts. */
export function installAppMenu({
  openLogFolder,
  logger,
}: {
  openLogFolder: () => Promise<void>;
  logger: Logger;
}): void {
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
}
