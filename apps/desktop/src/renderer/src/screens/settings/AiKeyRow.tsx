import type { AiKeyError, AiProviderEntry } from '@roastpilot/shared';
import { Button, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { ConfirmButton } from '../../features/ConfirmButton';
import { useRun } from '../../features/use-run';
import { SettingRow } from './SettingRow';

const KEY_FAILED: Readonly<Record<AiKeyError['kind'], string>> = {
  'unsafe-storage': "Can't store the key safely on this computer",
  'storage-failed': "Couldn't save the key · see Logs",
  'unknown-provider': 'That provider is gone · restart Roastpilot',
};

/** One provider's key: a password field and Save, or "Saved · ends 4f2a" with Replace and Remove. */
export function AiKeyRow({
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
