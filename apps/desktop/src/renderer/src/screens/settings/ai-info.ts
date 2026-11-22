/**
 * What the AI helpers do, said plainly (docs/spec/ai-helpers.md): the hint under each row, and the
 * few lines behind its ⓘ — what it does, where you use it, what it sends.
 */

export const AI_SWITCH = {
  name: 'Use AI helpers',
  hint: 'Tasting notes into taste tags · a supplier’s spec sheet into a bean’s details',
  info: [
    'Two helpers read text for you with your own API key: what a roast tasted like, and a green coffee’s spec sheet.',
    'Nothing they return is saved, and no profile changes, until you click. They never run during a roast.',
    'Off, everything works as before: tap the taste tags and type a bean’s details yourself.',
  ],
} as const;

export const TASTE_INFO = [
  'Write how a roast tasted, like “tart, a bit hay-like”. Read ticks the taste tags that match, and the tags suggest what to change in the next roast.',
  'Where: History › a roast › Roast details › Taste › In your words.',
  'Sends only those words, up to 500 characters.',
] as const;

export const SHEET_INFO = [
  'Give it a supplier’s spec sheet as a PDF or pasted text. It fills origin, process, variety, altitude, density, moisture and the rest, for you to check before Save.',
  'Where: Beans › Add bean, or a bean’s Edit › Fill from spec sheet.',
  'Sends only the sheet: up to 20 pages, or 20,000 characters.',
] as const;
