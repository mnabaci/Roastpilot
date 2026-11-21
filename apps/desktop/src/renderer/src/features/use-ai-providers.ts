import { serializeError } from '@roastpilot/core';
import type { AiProviderEntry } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../app/app-context';
import { useSettings } from '../stores/use-stores';

/**
 * The AI providers main registered, each with what it says about itself and whether its key is
 * saved (never the key), read when the screen opens; Settings updates it with what Save and
 * Remove answer. Nothing in the renderer names a provider.
 */
export function useAiProviders(): {
  providers: readonly AiProviderEntry[];
  setProviders: (providers: readonly AiProviderEntry[]) => void;
} {
  const { api, logger } = useDeps();
  const [providers, setProviders] = useState<readonly AiProviderEntry[]>([]);
  useEffect(() => {
    let current = true;
    api
      .listAiProviders()
      .then((listed) => {
        if (current) setProviders(listed);
      })
      .catch((error: unknown) => {
        logger.warn('ai.providers-read-failed', { error: serializeError(error) });
      });
    return () => {
      current = false;
    };
  }, [api, logger]);
  return { providers, setProviders };
}

/** What the AI helpers can do now: read tasting words, read spec sheets. */
export function useAiHelpers(): { taste: boolean; sheets: boolean } {
  const enabled = useSettings((s) => s.settings.ai.enabled);
  const { providers } = useAiProviders();
  const can = (job: 'taste' | 'specSheet') => providers.some((p) => p.reads[job] && p.key.saved);
  return { taste: enabled && can('taste'), sheets: enabled && can('specSheet') };
}
