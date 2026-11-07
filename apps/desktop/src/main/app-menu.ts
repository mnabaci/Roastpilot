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

/**
 * Only what text fields need: on macOS the keyboard shortcuts in a field (⌘C, ⌘V, ⌘Z) work through
 * these items. Electron's full Edit menu adds Paste and Match Style, Delete, Substitutions, Speech.
 */
const EDIT: MenuItemConstructorOptions = {
  label: 'Edit',
  submenu: [
    { role: 'undo' },
    { role: 'redo' },
    separator,
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'selectAll' },
  ],
};

/** The user defaults that keep macOS from adding its own items to the Edit menu. */
export const MAC_EDIT_EXTRAS_OFF = [
  'NSDisabledDictationMenuItem',
  'NSDisabledCharacterPaletteMenuItem',
  'NSDisabledAutoFillMenuItem',
] as const;

/** Start Dictation, Emoji & Symbols and AutoFill: macOS adds them to any menu named Edit. */
export function hideMacEditExtras(
  setUserDefault: (key: string, type: 'boolean', value: boolean) => void,
): void {
  for (const key of MAC_EDIT_EXTRAS_OFF) setUserDefault(key, 'boolean', true);
}

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
    EDIT,
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
