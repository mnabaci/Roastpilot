import type { Screen } from '@roastpilot/shared';

/** The screens in top-bar order, with their names (docs/spec/ui.md, Top bar). */
export const SCREENS: readonly { id: Screen; label: string }[] = [
  { id: 'roast', label: 'Roast' },
  { id: 'history', label: 'History' },
  { id: 'beans', label: 'Beans' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'roasters', label: 'Roasters' },
  { id: 'settings', label: 'Settings' },
  { id: 'logs', label: 'Logs' },
];

export const screenLabel = (screen: Screen): string =>
  SCREENS.find((s) => s.id === screen)?.label ?? screen;
