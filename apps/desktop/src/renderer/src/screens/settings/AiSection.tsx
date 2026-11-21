import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiKeyError,
  type AiKeys,
  type AiProvider,
} from '@roastpilot/shared';
import { Button, SegmentedControl, Switch, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useAiKeys } from '../../features/use-ai-keys';
import { useRun } from '../../features/use-run';
import { useSettings } from '../../stores/use-stores';
import { SettingRow, SettingRows, SettingSection } from './SettingRow';
import { useSaveSettings } from './use-save-settings';
import { whatGoes } from './what-goes';

const KEY_SOURCE: Readonly<Record<AiProvider, string>> = {
  claude: 'console.anthropic.com',
  jev: 'console.typesafe.ai',
};

const KEY_FAILED: Readonly<Record<AiKeyError['kind'], string>> = {
  'unsafe-storage': "Can't store the key safely on this computer",
  'storage-failed': "Couldn't save the key · see Logs",
};

const READERS = AI_PROVIDERS.map((value) => ({ value, label: AI_PROVIDER_LABELS[value] }));

/**
 * AI helpers (docs/spec/ai-helpers.md, Turning it on): off by default; your own keys, kept
 * encrypted in main; who reads tasting words; and what is sent where, in one line.
 */
export function AiSection() {
  const ai = useSettings((s) => s.settings.ai);
  const save = useSaveSettings();
  const { keys, setKeys } = useAiKeys();
  const anyKey = AI_PROVIDERS.some((p) => keys[p].saved);
  const bothKeys = AI_PROVIDERS.every((p) => keys[p].saved);
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
        {AI_PROVIDERS.map((provider) => (
          <KeyRow key={provider} provider={provider} keys={keys} onKeys={setKeys} />
        ))}
        <SettingRow
          name="Read tasting words with"
          hint={bothKeys ? 'Spec sheets always use Claude' : 'Add both keys to choose'}
        >
          <SegmentedControl
            label="Read tasting words with"
            options={READERS}
            value={ai.tasteProvider}
            disabled={!bothKeys}
            onChange={(tasteProvider) => {
              save({ ai: { ...ai, tasteProvider } });
            }}
          />
        </SettingRow>
      </SettingRows>
      <p className="text-label text-ink-muted">{whatGoes(keys, ai.tasteProvider)}</p>
    </SettingSection>
  );
}

/** One provider's key: a password field and Save, or "Saved · ends 4f2a" and Remove. */
function KeyRow({
  provider,
  keys,
  onKeys,
}: {
  provider: AiProvider;
  keys: AiKeys;
  onKeys: (keys: AiKeys) => void;
}) {
  const { api, logger } = useDeps();
  const run = useRun();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const name = `${AI_PROVIDER_LABELS[provider]} API key`;
  const status = keys[provider];
  const act = (event: string, call: () => ReturnType<typeof api.saveAiKey>) => {
    setBusy(true);
    setProblem(undefined);
    run(
      event,
      async () => {
        try {
          const answer = await call();
          if (answer.ok) {
            onKeys(answer.value);
            setTyped('');
            return;
          }
          logger.warn('ai.key-refused', { provider, kind: answer.error.kind });
          setProblem(KEY_FAILED[answer.error.kind]);
        } finally {
          setBusy(false);
        }
      },
      { failed: "Couldn't change the key · try again" },
    );
  };
  const hint = problem ?? `From ${KEY_SOURCE[provider]} · billed to you`;
  if (status.saved) {
    return (
      <SettingRow name={name} hint={hint} group>
        <div className="flex items-center gap-3">
          <span className="text-label text-ink-muted tabular-nums">
            Saved · ends {status.last4 ?? ''}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              act('ai.key-remove-failed', () => api.removeAiKey(provider));
            }}
          >
            Remove
          </Button>
        </div>
      </SettingRow>
    );
  }
  const key = typed.trim();
  return (
    <SettingRow name={name} hint={hint} group>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (key.length >= 8) act('ai.key-save-failed', () => api.saveAiKey({ provider, key }));
        }}
      >
        <TextField
          label="Key"
          type="password"
          className="w-64"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={setTyped}
        />
        <Button size="sm" type="submit" disabled={busy || key.length < 8}>
          Save
        </Button>
      </form>
    </SettingRow>
  );
}
