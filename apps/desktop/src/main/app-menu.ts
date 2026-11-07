// The app menu (docs/spec/ui.md, App menu). Pure: builds a template, Electron turns it into a menu.
import type { Screen } from '@roastpilot/shared';
import type { MenuItemConstructorOptions } from 'electron';

export interface AppMenuOptions {
  appName: string;
  platform: NodeJS.Platform;
  /** Reload and developer tools only in development. */
  dev: boolean;
  navigate: (screen: Screen) => void;
  showSafetyNotice: () => void;
  openLogFolder: () => void;
}

const separator: MenuItemConstructorOptions = { type: 'separator' };

export function buildAppMenu(options: AppMenuOptions): MenuItemConstructorOptions[] {
  const mac = options.platform === 'darwin';
  const settings: MenuItemConstructorOptions = {
    label: 'Settings…',
    accelerator: 'CmdOrCtrl+,',
    click: () => {
      options.navigate('settings');
    },
  };
  const devItems: MenuItemConstructorOptions[] = options.dev
    ? [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, separator]
    : [];

  return [
    ...(mac
      ? [
          {
            label: options.appName,
            submenu: [
              { role: 'about' },
              separator,
              settings,
              separator,
              { role: 'services' },
              separator,
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              separator,
              // Quit goes through the quit guard: safe stop first (docs/spec/safety.md).
              { role: 'quit' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'File',
      submenu: mac ? [{ role: 'close' }] : [settings, separator, { role: 'quit' }],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...devItems,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        separator,
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Safety notice',
          click: () => {
            options.showSafetyNotice();
          },
        },
        {
          label: 'Open log folder',
          click: () => {
            options.openLogFolder();
          },
        },
      ],
    },
  ];
}
