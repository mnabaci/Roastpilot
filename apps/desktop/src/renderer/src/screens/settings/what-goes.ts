import { AI_PROVIDERS, type AiKeys, type AiProvider } from '@roastpilot/shared';

const COMPANY: Readonly<Record<AiProvider, string>> = { claude: 'Anthropic', jev: 'TypeSafe' };

/** Who the words and sheets go to, for the keys you have, then what never leaves. */
export function whatGoes(keys: AiKeys, tasteProvider: AiProvider): string {
  const taste = keys[tasteProvider].saved ? tasteProvider : AI_PROVIDERS.find((p) => keys[p].saved);
  const stays = 'Roasts, beans and profiles stay on this computer.';
  const sheets = keys.claude.saved;
  if (!taste) return stays;
  if (sheets && taste === 'claude')
    return `Tasting words and spec sheets go to Anthropic. ${stays}`;
  const parts = [
    `Tasting words go to ${COMPANY[taste]}`,
    ...(sheets ? ['spec sheets to Anthropic'] : []),
  ];
  return `${parts.join(', ')}. ${stays}`;
}
