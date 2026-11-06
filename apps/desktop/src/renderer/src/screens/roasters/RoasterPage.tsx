import type { Roaster } from '@roastpilot/shared';
import { Button } from '@roastpilot/ui';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useConnection } from '../../stores/use-stores';
import { ConnectPanel } from './ConnectPanel';
import { RoasterEditor } from './RoasterEditor';
import { modelNote } from './roaster-model';

/** One roaster: connect it, then its record (docs/spec/ui.md, Roasters screen). */
export function RoasterPage({ roaster, onDeleted }: { roaster: Roaster; onDeleted: () => void }) {
  const { api, logger } = useDeps();
  const run = useRun();
  // Records wait while any roaster is in use (docs/spec/roasters.md).
  const locked = useConnection((s) => s.connection.status !== 'disconnected');
  const note = modelNote(roaster);
  const use = () => {
    run('roasters.activate-failed', async () => {
      const set = await api.setActiveRoaster(roaster.id);
      if (!set.ok) logger.warn('roasters.refused', { ...set.error });
    });
  };
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-title">{roaster.name}</h2>
          {note ? <p className="text-label text-ink-muted">{note}</p> : null}
        </div>
        {/* Profiles and batch sizes follow the active roaster, so it can change without connecting. */}
        {roaster.active || locked ? null : (
          <Button variant="ghost" size="sm" onClick={use}>
            Use this roaster
          </Button>
        )}
      </header>
      <ConnectPanel roaster={roaster} />
      <RoasterEditor key={roaster.id} roaster={roaster} locked={locked} onDeleted={onDeleted} />
    </div>
  );
}
