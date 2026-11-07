import type { Theme } from '@roastpilot/shared';
import { BrowserWindow, nativeTheme } from 'electron';
import { windowBackground } from './window-background';

/** The window colour behind the page, for the theme in use now. */
export const currentWindowBackground = (): string =>
  windowBackground(nativeTheme.shouldUseDarkColors);

const paintWindows = () => {
  for (const win of BrowserWindow.getAllWindows())
    win.setBackgroundColor(currentWindowBackground());
};

/**
 * Follows the Theme setting (docs/spec/ui.md, Settings): Electron's theme source, which the page's
 * `prefers-color-scheme` also follows, and the window colour behind the page.
 */
export function installWindowTheme(): (theme: Theme) => void {
  // Match system: the computer switched light or dark.
  nativeTheme.on('updated', paintWindows);
  return (theme) => {
    nativeTheme.themeSource = theme;
    paintWindows();
  };
}
