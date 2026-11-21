import { serializeError } from '@roastpilot/core';
import type { AiKeys, AiProvider } from '@roastpilot/shared';
import { useEffect, useState } from 'react';
import { useDeps } from '../app/app-context';
import { useSettings } from '../stores/use-stores';

const NO_KEYS: AiKeys = {
  claude: { saved: false, last4: null },
  jev: { saved: false, last4: null },
};

/**
 * Whether each AI provider has a key (never the key itself), read when the screen opens; Settings
 * updates it with what Save and Remove answer.
 */
export function useAiKeys(): {
  keys: AiKeys;
  setKeys: (keys: AiKeys) => void;
} {
  const { api, logger } = useDeps();
  const [keys, setKeys] = useState<AiKeys>(NO_KEYS);
  useEffect(() => {
    let current = true;
    api
      .getAiKeys()
      .then((read) => {
        if (current) setKeys(read);
      })
      .catch((error: unknown) => {
        logger.warn('ai.keys-read-failed', { error: serializeError(error) });
      });
    return () => {
      current = false;
    };
  }, [api, logger]);
  return { keys, setKeys };
}

/** What the AI helpers can do now: read tasting words, read spec sheets. */
export function useAiHelpers(): { taste: boolean; sheets: boolean } {
  const ai = useSettings((s) => s.settings.ai);
  const { keys } = useAiKeys();
  const has = (provider: AiProvider) => keys[provider].saved;
  return {
    taste: ai.enabled && (has('claude') || has('jev')),
    sheets: ai.enabled && has('claude'),
  };
}
