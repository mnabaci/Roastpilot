import { beanHints, suggestProfile } from '@roastpilot/core';
import type { RoastSetup, RoastSummary } from '@roastpilot/shared';
import { Button, NumberField, SelectField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { activeRoaster } from '../../stores/roasters-store';
import { useAuto, useBeans, useRoast, useRoasters, useSettings } from '../../stores/use-stores';
import { roastTitle } from '../history/history-format';
import { useRoastList } from '../history/use-roast-list';
import { useSaveSettings } from '../settings/use-save-settings';
import { setupForBean, stockWarning } from './roast-setup';
import { useActiveProfile } from './use-active-profile';

const NONE = 'none';

const ghostLabel = (roast: RoastSummary) =>
  `${roast.isFavourite ? '★ ' : ''}${roastTitle(roast.startedAt)}`;

/**
 * What the next roast is of: bean, batch, the suggested profile and the ghost; every part optional
 * (docs/spec/ui.md, Before preheat). Once it runs only the ghost can change.
 */
export function RoastSetupPanel() {
  const { api, stores } = useDeps();
  const run = useRun();
  const phase = useRoast((s) => s.roast.phase);
  const beans = useBeans((s) => s.beans);
  const setup = useBeans((s) => s.setup);
  const roasters = useRoasters((s) => s.roasters);
  const mode = useSettings((s) => s.settings.roastMode);
  const profiles = useAuto((s) => s.profiles);
  const active = useActiveProfile();
  const saveSettings = useSaveSettings();
  const roasts = useRoastList();
  const [changing, setChanging] = useState(false);
  const [batchText, setBatchText] = useState<string>();

  const roaster = activeRoaster(roasters);
  const bean = beans.find((b) => b.id === setup.beanId);
  const list = roasts ?? [];
  const update = (next: RoastSetup) => {
    stores.beans.setState({ setup: next });
    run('roast.setup-failed', () => api.setRoastSetup(next));
  };

  const ghostField = (
    <SelectField
      label="Ghost"
      value={setup.ghostRoastId === null ? NONE : String(setup.ghostRoastId)}
      options={[
        { value: NONE, label: 'None' },
        ...list.map((r) => ({ value: String(r.id), label: ghostLabel(r) })),
      ]}
      onChange={(value) => {
        update({ ...setup, ghostRoastId: value === NONE ? null : Number(value) });
      }}
    />
  );

  // A roast is on: the bean and batch went with it.
  const summary = [
    bean?.name ?? 'No bean',
    setup.batchG === null ? null : `${String(setup.batchG)} g`,
  ]
    .filter(Boolean)
    .join(' · ');
  if (phase !== 'ready' && !(phase === 'done' && changing)) {
    return (
      <section aria-label="This roast" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-body">{summary}</p>
          {phase === 'done' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setChanging(true);
              }}
            >
              Change
            </Button>
          ) : null}
        </div>
        {ghostField}
      </section>
    );
  }

  const suggestion =
    mode === 'auto'
      ? suggestProfile({
          bean,
          beans,
          roasts: list,
          available: profiles.map((e) => e.profile.id),
        })
      : undefined;
  const suggested = profiles.find((e) => e.profile.id === suggestion?.profileId);
  const batch = batchText ?? (setup.batchG === null ? '' : String(setup.batchG));
  const warning = stockWarning(bean, setup.batchG);
  return (
    <section aria-label="Next roast" className="flex flex-col gap-2">
      <SelectField
        label="Bean"
        value={setup.beanId === null ? NONE : String(setup.beanId)}
        options={[
          { value: NONE, label: 'No bean' },
          ...beans.filter((b) => !b.archived).map((b) => ({ value: String(b.id), label: b.name })),
        ]}
        onChange={(value) => {
          if (!roaster) return;
          const picked = beans.find((b) => String(b.id) === value);
          setBatchText(undefined);
          update(
            setupForBean(picked, { roaster, roasts: list, profileId: active?.profile.id ?? null }),
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
            update({ ...setup, batchG: grams > 0 ? grams : null });
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
      {ghostField}
    </section>
  );
}
