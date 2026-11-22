import type { AiProviderEntry, AiProviderId } from '@roastpilot/shared';

/** A job the AI helpers do. */
export type AiJob = 'taste' | 'specSheet';

/** The providers that do `job`, as main listed them. */
export const capableOf = (providers: readonly AiProviderEntry[], job: AiJob): AiProviderEntry[] =>
  providers.filter((p) => p.models[job] !== null);

/** The providers that do `job` and have a key, the chosen one first. */
function usable(
  providers: readonly AiProviderEntry[],
  job: AiJob,
  chosen: AiProviderId | null,
): AiProviderEntry[] {
  return capableOf(providers, job)
    .filter((p) => p.key.saved)
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
 * Where a job's text goes and the model that reads it, as the provider says: "To Anthropic ·
 * Haiku 5.5"; with no key for it, that nothing is sent.
 */
export function jobLine(reader: AiProviderEntry | undefined, job: AiJob): string {
  const model = reader?.models[job];
  if (!reader || !model) return 'Nothing sent · add a key that reads them';
  return `To ${reader.company} · ${model}`;
}
