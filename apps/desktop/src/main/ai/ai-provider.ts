import type { SpecSheetReader, TasteReader } from '@roastpilot/core';
import type { AiKeyStatus, AiProviderEntry, AiProviderInfo } from '@roastpilot/shared';

/**
 * One AI provider as main registers it (docs/spec/ai-helpers.md, Providers; ADR 0027): what it
 * says about itself, and the readers it has. Adding a provider is a new module that exports one
 * of these and a line in ai-wiring.ts; nothing else names it.
 */
export interface AiProvider {
  info: Omit<AiProviderInfo, 'models'>;
  taste?: TasteReader;
  specSheet?: SpecSheetReader;
}

/** The model each of its readers reads with first; null for a job it has no reader for. */
export const modelsOf = (provider: AiProvider): AiProviderInfo['models'] => ({
  taste: provider.taste?.modelName ?? null,
  specSheet: provider.specSheet?.modelName ?? null,
});

/** The providers as Settings lists them, each with its key's status. */
export function providerEntries(
  providers: readonly AiProvider[],
  keys: Readonly<Record<string, AiKeyStatus>>,
): AiProviderEntry[] {
  return providers.map((provider) => ({
    ...provider.info,
    models: modelsOf(provider),
    key: keys[provider.info.id] ?? { saved: false, last4: null },
  }));
}
