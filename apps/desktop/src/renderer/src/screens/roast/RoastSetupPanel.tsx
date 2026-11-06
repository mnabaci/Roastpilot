import type { RoastSetup } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { activeRoaster } from '../../stores/roasters-store';
import { useBeans, useRoast, useRoasters, useSettings } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { ghostLabel } from './ghost';
import { GhostField } from './GhostField';
import { ModeControl } from './ModeControl';
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
  const [open, setOpen] = useState(false);
  const update = (next: RoastSetup) => {
    stores.beans.setState({ setup: next });
    run('roast.setup-failed', () => api.setRoastSetup(next));
  };
  const idle = phase === 'ready' || phase === 'done';
  const bean = beans.find((b) => b.id === setup.beanId);
  const ghost = roasts.find((r) => r.id === setup.ghostRoastId);
  const line = [
    mode === 'auto' ? profile?.profile.name : undefined,
    bean?.name ?? 'No bean',
    setup.batchG === null ? undefined : `${String(setup.batchG)} g`,
    ghost ? `ghost ${ghostLabel(ghost)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <section aria-label="Setup" className="flex flex-col gap-3 rounded-xl bg-surface px-5 py-4.5">
      <ModeControl withProfile={open && !profileLocked} />
      <div className="flex items-center justify-between gap-2">
        <p title={line} className="min-w-0 truncate text-body">
          {line}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-expanded={open}
          icon={
            <ChevronDown
              aria-hidden="true"
              className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          }
          onClick={() => {
            setOpen(!open);
          }}
        >
          Change
        </Button>
      </div>
      {open && idle ? (
        <SetupForm
          setup={setup}
          beans={beans}
          roaster={roaster}
          roasts={roasts}
          onChange={update}
        />
      ) : null}
      {open ? <GhostField setup={setup} roasts={roasts} onChange={update} /> : null}
    </section>
  );
}
