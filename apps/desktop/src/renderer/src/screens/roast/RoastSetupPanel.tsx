import type { RoastSetup } from '@roastpilot/shared';
import { cn, Switch } from '@roastpilot/ui';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { activeRoaster } from '../../stores/roasters-store';
import { useBeans, useRoast, useRoasters, useSettings } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { ghostLabel } from './ghost';
import { GhostField } from './GhostField';
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
    run('roast.setup-failed', () => api.setRoastSetup(next));
  };
  const idle = phase === 'ready' || phase === 'done';
  const bean = beans.find((b) => b.id === setup.beanId);
  const ghost = roasts.find((r) => r.id === setup.ghostRoastId);
  const line = [
    mode === 'auto' ? profile?.profile.name : 'Manual',
    // Second, so it shows before the line truncates: a first Auto roast needs you close by.
    mode === 'auto' && profile?.profile.needsCalibration ? 'needs calibration' : undefined,
    bean?.name ?? 'No bean',
    setup.batchG === null ? undefined : `${String(setup.batchG)} g`,
    ghost ? `ghost ${ghostLabel(ghost)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <section aria-label="Setup" className="flex flex-col rounded-xl bg-surface">
      <div className="flex items-center gap-3 py-2 pr-5 pl-2">
        {/* The whole row opens the card; the Auto switch beside it stays live mid-roast. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label="Change setup"
          title={line}
          onClick={() => {
            setOpen(!open);
          }}
          className="flex min-h-control-sm min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="min-w-0 truncate text-body">{line}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-5 shrink-0 text-ink-muted transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
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
      </div>
      {open ? (
        <div className="flex flex-col gap-3 px-5 pb-4.5">
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
          <GhostField setup={setup} roasts={roasts} beans={beans} onChange={update} />
        </div>
      ) : null}
    </section>
  );
}
