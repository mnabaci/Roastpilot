import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { buildAppMenu, type AppMenuOptions } from './app-menu';

function build(overrides: Partial<AppMenuOptions> = {}) {
  const navigate = vi.fn();
  const openLogFolder = vi.fn();
  const menu = buildAppMenu({
    appName: 'Roastpilot',
    platform: 'darwin',
    dev: false,
    navigate,
    openLogFolder,
    ...overrides,
  });
  return { menu, navigate, openLogFolder };
}

/** Every item in the menu, nested ones included. */
function items(menu: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return menu.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? items(item.submenu) : []),
  ]);
}

function click(item: MenuItemConstructorOptions | undefined) {
  // The menu only reads `click`; the arguments Electron passes are not used.
  (item?.click as (() => void) | undefined)?.();
}

const byLabel = (menu: MenuItemConstructorOptions[], label: string) =>
  items(menu).find((item) => item.label === label);
const roles = (menu: MenuItemConstructorOptions[]) => items(menu).map((item) => item.role);

describe('buildAppMenu', () => {
  it.each(['darwin', 'win32'] as const)(
    'on %s, Settings… (⌘, / Ctrl+,) opens Settings',
    (platform) => {
      const { menu, navigate } = build({ platform });
      const settings = byLabel(menu, 'Settings…');
      expect(settings?.accelerator).toBe('CmdOrCtrl+,');
      click(settings);
      expect(navigate).toHaveBeenCalledWith('settings');
    },
  );

  it('Open log folder opens it', () => {
    const { menu, openLogFolder } = build();
    click(byLabel(menu, 'Open log folder'));
    expect(openLogFolder).toHaveBeenCalledOnce();
  });

  it('macOS: the first menu is the app, with Quit', () => {
    const { menu } = build();
    expect(menu[0]?.label).toBe('Roastpilot');
    expect(roles(menu)).toContain('quit');
  });

  it('Windows: no app menu; File has Settings… and Quit', () => {
    const { menu } = build({ platform: 'win32' });
    expect(menu[0]?.label).toBe('File');
    expect(roles(menu[0]?.submenu as MenuItemConstructorOptions[])).toContain('quit');
    expect(roles(menu)).not.toContain('about');
  });

  it('no Reload or developer tools in the packaged app', () => {
    const { menu } = build({ dev: false });
    expect(roles(menu)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/reload|forceReload|toggleDevTools/)]),
    );
  });

  it('Reload and developer tools in development', () => {
    const { menu } = build({ dev: true });
    expect(roles(menu)).toEqual(
      expect.arrayContaining(['reload', 'forceReload', 'toggleDevTools']),
    );
  });
});
