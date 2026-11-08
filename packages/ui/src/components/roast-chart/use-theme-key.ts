import { useEffect, useState } from 'react';

/**
 * The page's theme (`data-theme` on the root), as a key that changes with it. The plots draw on a
 * canvas with colours read when they are built, so a theme change (Match system flipping mid-roast)
 * must rebuild them, or the chart keeps the old theme's colours.
 */
export function useThemeKey(): string {
  const root = document.documentElement;
  const [theme, setTheme] = useState(() => root.dataset.theme ?? '');
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(root.dataset.theme ?? '');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      observer.disconnect();
    };
  }, [root]);
  return theme;
}
