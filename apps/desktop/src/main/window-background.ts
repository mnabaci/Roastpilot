import tokens from '@roastpilot/ui/tokens.json';

// The renderer is dark (index.html sets data-theme="dark"); painting the window with the same `bg`
// token before the page loads avoids a white flash.
const bg = tokens.color.tokens.find((token) => token.name === 'bg');
if (!bg) throw new Error('tokens.json has no `bg` colour');

export const WINDOW_BACKGROUND: string = bg.value.dark;
