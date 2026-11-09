import { beanHints, suggestProfile } from '@roastpilot/core';
import type { Bean, Roaster, RoastSetup, RoastSummary } from '@roastpilot/shared';
import { Button, NumberField, SelectField } from '@roastpilot/ui';
import { beanDetail } from '../beans/bean-detail';
import { useState } from 'react';
import { useAuto, useSettings } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import { batchWarning, setupForBean, stockWarning, tunedForG } from './roast-setup';
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
  const coach = useSettings((s) => s.settings.coachInManual);
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
  const tunedFor = tunedForG({ roastMode: mode, coachInManual: coach }, active?.profile);
  const batchNote = bean ? batchWarning(setup.batchG, tunedFor) : undefined;
  return (
    <>
      <SelectField
        label="Bean"
        value={setup.beanId === null ? NONE : String(setup.beanId)}
        options={[
          { value: NONE, label: 'No bean' },
          ...beans
            .filter((b) => !b.archived || b.id === setup.beanId)
            .map((b) => ({ value: String(b.id), label: b.name, detail: beanDetail(b) })),
        ]}
        onChange={(value) => {
          if (!roaster) return;
          const picked = beans.find((b) => String(b.id) === value);
          setBatchText(undefined);
          onChange(
            setupForBean(picked, {
              plan: { roaster, profiles, autoProfileG: active?.profile.batchG },
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
      {batchNote ? <p className="text-label text-ink-muted">{batchNote}</p> : null}
      {warning ? <p className="text-label text-critical-text">{warning}</p> : null}
      {bean && suggestion && suggested && suggested.profile.id !== active?.profile.id ? (
        // What it is, which one, and why; hidden once it is the one picked.
        <section aria-label="Suggested profile" className="flex flex-col gap-1">
          <p className="text-label text-ink-muted">Suggested profile</p>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-body text-ink">{suggested.profile.name}</p>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => {
                saveSettings({ autoProfile: suggested.profile.id });
              }}
            >
              Use this profile
            </Button>
          </div>
          <p className="text-label text-ink-muted">{suggestion.reason}</p>
        </section>
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
