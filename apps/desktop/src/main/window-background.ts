import tokens from '@roastpilot/ui/tokens.json';

// Painting the window with the page's own `bg` token, before the page loads and whenever the theme
// changes, avoids a white or dark flash behind it.
const bg = tokens.color.tokens.find((token) => token.name === 'bg');
if (!bg) throw new Error('tokens.json has no `bg` colour');
const BG = bg.value;

/** The `bg` token for the dark or the light theme. */
export const windowBackground = (dark: boolean): string => (dark ? BG.dark : BG.light);
