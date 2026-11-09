import type { RoastSetup } from '@roastpilot/shared';
import { Badge, CollapsibleCard, Switch } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { activeRoaster } from '../../stores/roasters-store';
import { useBeans, useRoast, useRoasters, useSettings } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { ghostLabel } from './ghost';
import { GhostField } from './GhostField';
import { PreheatHoldField } from './PreheatHoldField';
import { ProfilePicker } from './ProfilePicker';
import { useSaveSettings } from '../settings/use-save-settings';
import { SetupForm } from './SetupForm';
import { useActiveProfile, useProfileLocked } from './use-active-profile';

/**
 * The setup card (docs/spec/ui.md, Setup card): who drives, then one line of what the roast is of,
 * with Change to open the rest. Before or after a roast that is the whole setup; mid-roast only the
 * ghost, the one part that can still change.
 */
export function RoastSetupPanel() {
  const { api, stores } = useDeps();
  const run = useRun();
  const phase = useRoast((s) => s.roast.phase);
  const beans = useBeans((s) => s.beans);
  const setup = useBeans((s) => s.setup);
  const roaster = useRoasters((s) => activeRoaster(s.roasters));
  const mode = useSettings((s) => s.settings.roastMode);
  const profile = useActiveProfile();
  // The profile can't change from Preheat until Drop; then its name sits in the line instead.
  const profileLocked = useProfileLocked();
  const roasts = useRoastList() ?? [];
  const saveSettings = useSaveSettings();
  const [open, setOpen] = useState(false);
  const update = (next: RoastSetup) => {
    stores.beans.setState({ setup: next });
    run('roast.setup-failed', () => api.setRoastSetup(next), {
      failed: "Couldn't save the setup · try again",
    });
  };
  const idle = phase === 'ready' || phase === 'done';
  const bean = beans.find((b) => b.id === setup.beanId);
  const ghost = roasts.find((r) => r.id === setup.ghostRoastId);
  const needsCalibration = mode === 'auto' && profile?.profile.needsCalibration === true;
  const head = (mode === 'auto' ? profile?.profile.name : undefined) ?? 'Manual';
  const rest = [
    bean?.name ?? 'No bean',
    setup.batchG === null ? undefined : `${String(setup.batchG)} g`,
    ghost ? `ghost ${ghostLabel(ghost)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const line = `${head} · ${rest}`;
  return (
    <section aria-label="Setup">
      <CollapsibleCard
        label="Change setup"
        tooltip={needsCalibration ? `${line} · needs calibration` : line}
        title={
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            {/* Two short lines, each cut at its end, so the card stays low in the narrow panel;
                the whole line is in the tooltip. */}
            <span className="max-w-full truncate text-body">{head}</span>
            <span className="max-w-full truncate text-label text-ink-muted">{rest}</span>
            {/* A badge, not a word in the line: a first Auto roast needs you close. */}
            {needsCalibration ? <Badge className="mt-1">Needs calibration</Badge> : null}
          </span>
        }
        action={
          <>
            <span className="text-label text-ink-muted" aria-hidden="true">
              Auto
            </span>
            <Switch
              aria-label="Auto"
              checked={mode === 'auto'}
              onChange={(on) => {
                saveSettings({ roastMode: on ? 'auto' : 'manual' });
              }}
            />
          </>
        }
        open={open}
        onOpenChange={setOpen}
      >
        {mode === 'auto' && !profileLocked ? <ProfilePicker /> : null}
        {idle ? (
          <SetupForm
            setup={setup}
            beans={beans}
            roaster={roaster}
            roasts={roasts}
            onChange={update}
          />
        ) : null}
        {mode === 'auto' && roaster && (idle || phase === 'preheat') ? (
          <PreheatHoldField roaster={roaster} roasts={roasts} />
        ) : null}
        <GhostField setup={setup} roasts={roasts} beans={beans} onChange={update} />
      </CollapsibleCard>
    </section>
  );
}
