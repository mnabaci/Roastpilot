import { beanHints, suggestProfile } from '@roastpilot/core';
import type { Bean, Roaster, RoastSetup, RoastSummary } from '@roastpilot/shared';
import { Button, NumberField, SelectField } from '@roastpilot/ui';
import { useState } from 'react';
import { useAuto, useSettings } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import { setupForBean, stockWarning } from './roast-setup';
import { useActiveProfile } from './use-active-profile';

const NONE = 'none';

/** Bean, batch and the suggested profile for the next roast (docs/spec/ui.md, Before preheat). */
export function SetupForm({
  setup,
  beans,
  roaster,
  roasts,
  onChange,
}: {
  setup: RoastSetup;
  beans: readonly Bean[];
  roaster: Roaster | undefined;
  roasts: readonly RoastSummary[];
  onChange: (setup: RoastSetup) => void;
}) {
  const mode = useSettings((s) => s.settings.roastMode);
  const profiles = useAuto((s) => s.profiles);
  const active = useActiveProfile();
  const saveSettings = useSaveSettings();
  const [batchText, setBatchText] = useState<string>();
  const bean = beans.find((b) => b.id === setup.beanId);
  const suggestion =
    mode === 'auto'
      ? suggestProfile({
          bean,
          beans,
          roasts,
          available: profiles.map((e) => e.profile.id),
        })
      : undefined;
  const suggested = profiles.find((e) => e.profile.id === suggestion?.profileId);
  const batch = batchText ?? (setup.batchG === null ? '' : String(setup.batchG));
  const warning = stockWarning(bean, setup.batchG);
  return (
    <>
      <SelectField
        label="Bean"
        value={setup.beanId === null ? NONE : String(setup.beanId)}
        options={[
          { value: NONE, label: 'No bean' },
          ...beans
            .filter((b) => !b.archived || b.id === setup.beanId)
            .map((b) => ({ value: String(b.id), label: b.name })),
        ]}
        onChange={(value) => {
          if (!roaster) return;
          const picked = beans.find((b) => String(b.id) === value);
          setBatchText(undefined);
          onChange(
            setupForBean(picked, {
              roaster,
              roasts,
              profileId: active?.profile.id ?? null,
            }),
          );
        }}
      />
      {bean ? (
        <NumberField
          label="Batch"
          unit="g"
          value={batch}
          onChange={(value) => {
            setBatchText(value);
            const grams = Number(value);
            onChange({ ...setup, batchG: grams > 0 ? grams : null });
          }}
        />
      ) : null}
      {warning ? <p className="text-label text-critical-text">{warning}</p> : null}
      {bean && suggestion && suggested ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-label text-ink-muted">
            {suggested.profile.name} · {suggestion.reason}
          </p>
          {suggested.profile.id !== active?.profile.id ? (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                saveSettings({ autoProfile: suggested.profile.id });
              }}
            >
              Use
            </Button>
          ) : null}
        </div>
      ) : null}
      {bean
        ? beanHints(bean).map((hint) => (
            <p key={hint} className="text-label text-ink-muted">
              {hint}
            </p>
          ))
        : null}
    </>
  );
}
