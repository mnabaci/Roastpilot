import type { AiProviderEntry, AiProviderId } from '@roastpilot/shared';

/** The providers that do `job` and have a key, the chosen one first. */
function usable(
  providers: readonly AiProviderEntry[],
  job: 'taste' | 'specSheet',
  chosen: AiProviderId | null,
): AiProviderEntry[] {
  return providers
    .filter((p) => p.reads[job] && p.key.saved)
    .toSorted((a, b) => Number(b.id === chosen) - Number(a.id === chosen));
}

/** Who reads tasting words: the one chosen while it has a key, else the first that can. */
export const tasteReader = (
  providers: readonly AiProviderEntry[],
  chosen: AiProviderId | null,
): AiProviderEntry | undefined => usable(providers, 'taste', chosen)[0];

/** Who reads spec sheets: the first that can and has a key. */
export const sheetReader = (providers: readonly AiProviderEntry[]): AiProviderEntry | undefined =>
  usable(providers, 'specSheet', null)[0];

/**
 * Who the words and sheets go to, for the keys you have, then what never leaves; each company as
 * its provider says it.
 */
export function whatGoes(
  providers: readonly AiProviderEntry[],
  chosen: AiProviderId | null,
): string {
  const stays = 'Roasts, beans and profiles stay on this computer.';
  const taste = tasteReader(providers, chosen)?.company;
  const sheets = sheetReader(providers)?.company;
  if (taste && sheets && taste === sheets)
    return `Tasting words and spec sheets go to ${taste}. ${stays}`;
  const parts = [
    ...(taste ? [`tasting words go to ${taste}`] : []),
    ...(sheets ? [`spec sheets ${taste ? 'to' : 'go to'} ${sheets}`] : []),
  ];
  if (parts.length === 0) return stays;
  const sent = parts.join(', ');
  return `${sent.charAt(0).toUpperCase()}${sent.slice(1)}. ${stays}`;
}
