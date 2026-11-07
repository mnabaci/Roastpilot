import type { Theme } from '@roastpilot/shared';
import { useEffect } from 'react';
import { useSettings } from '../stores/use-stores';

const SYSTEM_DARK = '(prefers-color-scheme: dark)';

/** The page's colours come from `data-theme` on the root (packages/ui tokens). */
function paint(root: HTMLElement, theme: 'dark' | 'light'): void {
  root.dataset.theme = theme;
}

/**
 * Puts the Theme setting on the page (`data-theme`, docs/spec/ui.md, Settings). Match system
 * follows the computer as it changes; main sets Electron's theme, which this query follows too.
 */
export function useTheme(root: HTMLElement = document.documentElement): void {
  const theme: Theme = useSettings((s) => s.settings.theme);
  useEffect(() => {
    if (theme !== 'system') {
      paint(root, theme);
      return undefined;
    }
    const query = window.matchMedia(SYSTEM_DARK);
    const follow = () => {
      paint(root, query.matches ? 'dark' : 'light');
    };
    follow();
    query.addEventListener('change', follow);
    return () => {
      query.removeEventListener('change', follow);
    };
  }, [root, theme]);
}
