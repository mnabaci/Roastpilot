import { Switch } from '@roastpilot/ui';
import { useAiProviders } from '../../features/use-ai-providers';
import { useSettings } from '../../stores/use-stores';
import { AiKeyRow } from './AiKeyRow';
import { AiReadersCard } from './AiReadersCard';
import { SettingRow, SettingRows, SettingSection } from './SettingRow';
import { useSaveSettings } from './use-save-settings';

/**
 * AI helpers (docs/spec/ai-helpers.md, Turning it on): off by default; your own keys, kept
 * encrypted in main; who reads what, with which model; and what never leaves, in one line.
 */
export function AiSection() {
  const ai = useSettings((s) => s.settings.ai);
  const save = useSaveSettings();
  const { providers, setProviders } = useAiProviders();
  const anyKey = providers.some((p) => p.key.saved);
  return (
    <SettingSection title="AI helpers">
      <SettingRows>
        <SettingRow
          name="Use AI to read words and spec sheets"
          hint={anyKey ? 'Tasting words into tags, spec sheets into beans' : 'Save a key first'}
        >
          <Switch
            aria-label="Use AI to read words and spec sheets"
            checked={ai.enabled && anyKey}
            disabled={!anyKey}
            onChange={(enabled) => {
              save({ ai: { ...ai, enabled } });
            }}
          />
        </SettingRow>
        {providers.map((provider) => (
          <AiKeyRow key={provider.id} provider={provider} onProviders={setProviders} />
        ))}
      </SettingRows>
      {providers.length > 0 ? (
        <AiReadersCard
          providers={providers}
          chosen={ai.tasteProvider}
          onChoose={(tasteProvider) => {
            save({ ai: { ...ai, tasteProvider } });
          }}
        />
      ) : null}
      <p className="text-label text-ink-muted">Roasts, beans and profiles stay on this computer.</p>
    </SettingSection>
  );
}
