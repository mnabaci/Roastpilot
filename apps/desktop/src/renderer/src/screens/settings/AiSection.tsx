import type { AiKeyError, AiProviderEntry } from '@roastpilot/shared';
import { Button, SegmentedControl, Switch, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { ConfirmButton } from '../../features/ConfirmButton';
import { useAiProviders } from '../../features/use-ai-providers';
import { useRun } from '../../features/use-run';
import { useSettings } from '../../stores/use-stores';
import { SettingRow, SettingRows, SettingSection } from './SettingRow';
import { useSaveSettings } from './use-save-settings';
import { sheetReader, tasteReader, whatGoes } from './what-goes';

const KEY_FAILED: Readonly<Record<AiKeyError['kind'], string>> = {
  'unsafe-storage': "Can't store the key safely on this computer",
  'storage-failed': "Couldn't save the key · see Logs",
  'unknown-provider': 'That provider is gone · restart Roastpilot',
};

/**
 * AI helpers (docs/spec/ai-helpers.md, Turning it on): off by default; your own keys, kept
 * encrypted in main; who reads tasting words; and what is sent where, in one line.
 */
export function AiSection() {
  const ai = useSettings((s) => s.settings.ai);
  const save = useSaveSettings();
  const { providers, setProviders } = useAiProviders();
  const anyKey = providers.some((p) => p.key.saved);
  // Who can read tasting words, as the providers say; a choice only once two have keys.
  const tasteCapable = providers.filter((p) => p.reads.taste);
  const tasteReady = tasteCapable.filter((p) => p.key.saved);
  const reader = tasteReader(providers, ai.tasteProvider);
  const sheets = sheetReader(providers) ?? providers.find((p) => p.reads.specSheet);
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
          <KeyRow key={provider.id} provider={provider} onProviders={setProviders} />
        ))}
        {tasteCapable.length > 1 ? (
          <SettingRow
            name="Read tasting words with"
            hint={
              tasteReady.length > 1
                ? sheets
                  ? `Spec sheets use ${sheets.label}`
                  : 'Who reads your tasting words'
                : 'Add a second key to choose'
            }
          >
            <SegmentedControl
              label="Read tasting words with"
              options={tasteCapable.map((p) => ({ value: p.id, label: p.label }))}
              // The reader actually used: with one key, that one, whatever was chosen before.
              value={reader?.id ?? ai.tasteProvider ?? tasteCapable[0]?.id ?? ''}
              disabled={tasteReady.length < 2}
              onChange={(tasteProvider) => {
                save({ ai: { ...ai, tasteProvider } });
              }}
            />
          </SettingRow>
        ) : null}
      </SettingRows>
      <p className="text-label text-ink-muted">{whatGoes(providers, ai.tasteProvider)}</p>
    </SettingSection>
  );
}

/** One provider's key: a password field and Save, or "Saved · ends 4f2a" with Replace and Remove. */
function KeyRow({
  provider,
  onProviders,
}: {
  provider: AiProviderEntry;
  onProviders: (providers: readonly AiProviderEntry[]) => void;
}) {
  const { api, logger } = useDeps();
  const run = useRun();
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  /** Typing a new key over a saved one; the saved one stays until Save. */
  const [replacing, setReplacing] = useState(false);
  const name = `${provider.label} API key`;
  const status = provider.key;
  const act = (event: string, call: () => ReturnType<typeof api.saveAiKey>) => {
    setBusy(true);
    setProblem(undefined);
    run(
      event,
      async () => {
        try {
          const answer = await call();
          if (answer.ok) {
            onProviders(answer.value);
            setTyped('');
            setReplacing(false);
            return;
          }
          logger.warn('ai.key-refused', { provider: provider.id, kind: answer.error.kind });
          setProblem(KEY_FAILED[answer.error.kind]);
        } finally {
          setBusy(false);
        }
      },
      { failed: "Couldn't change the key · try again" },
    );
  };
  const hint = problem ?? `From ${provider.keyFrom} · billed to you`;
  if (status.saved && !replacing) {
    return (
      <SettingRow name={name} hint={hint} group>
        <div className="flex items-center gap-2">
          <span className="pr-1 text-label text-ink-muted tabular-nums">
            Saved · ends {status.last4 ?? ''}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setProblem(undefined);
              setReplacing(true);
            }}
          >
            Replace
          </Button>
          <ConfirmButton
            label="Remove"
            destructive
            question={`Remove the ${name}? · ${provider.label} stops reading for you`}
            confirmLabel="Remove"
            onConfirm={() => {
              act('ai.key-remove-failed', () => api.removeAiKey(provider.id));
            }}
          />
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
          if (key.length >= 8)
            act('ai.key-save-failed', () => api.saveAiKey({ provider: provider.id, key }));
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
        {replacing ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setTyped('');
              setReplacing(false);
            }}
          >
            Cancel
          </Button>
        ) : null}
        <Button size="sm" type="submit" disabled={busy || key.length < 8}>
          Save
        </Button>
      </form>
    </SettingRow>
  );
}
