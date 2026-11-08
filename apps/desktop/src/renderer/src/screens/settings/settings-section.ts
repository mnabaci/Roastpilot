/** The Settings sections, in sidebar order (docs/spec/ui.md, Settings). */
export const SETTINGS_SECTIONS = [
  { id: 'controls', label: 'Controls' },
  { id: 'roast', label: 'Roast' },
  { id: 'sounds', label: 'Sounds' },
  { id: 'chart', label: 'Chart' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'about', label: 'About' },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id'];
