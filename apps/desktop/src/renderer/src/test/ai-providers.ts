import type { AiProviderEntry } from '@roastpilot/shared';

// AI providers as main would list them, for the renderer tests: the ids and names are only
// examples, as the screens name no provider of their own.

const NO_KEY = { saved: false, last4: null };

/** Reads tasting words and spec sheets. */
export const WORDS_AND_SHEETS: AiProviderEntry = {
  id: 'alpha',
  label: 'Alpha',
  company: 'Alpha Labs',
  keyFrom: 'keys.alpha.example',
  reads: { taste: true, specSheet: true },
  key: NO_KEY,
};

/** Reads tasting words only. */
export const WORDS_ONLY: AiProviderEntry = {
  id: 'beta',
  label: 'Beta',
  company: 'Beta Inc',
  keyFrom: 'keys.beta.example',
  reads: { taste: true, specSheet: false },
  key: NO_KEY,
};

/** The provider with its key saved, ending in `last4`. */
export const withKey = (provider: AiProviderEntry, last4: string): AiProviderEntry => ({
  ...provider,
  key: { saved: true, last4 },
});
