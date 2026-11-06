import type { Roaster } from '@roastpilot/shared';
import { ConfirmDialog, Menu, type MenuItem } from '@roastpilot/ui';
import { useState } from 'react';
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
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const use = () => {
    run('roasters.activate-failed', async () => {
      const set = await api.setActiveRoaster(roaster.id);
      if (!set.ok) logger.warn('roasters.refused', { ...set.error });
    });
  };
  const remove = () => {
    run('roasters.delete-failed', async () => {
      const result = await api.deleteRoaster(roaster.id);
      if (result.ok) {
        onDeleted();
        return;
      }
      logger.warn('roasters.refused', { ...result.error });
      setProblem(
        result.error.kind === 'has-roasts'
          ? 'It has saved roasts or profiles · it stays'
          : "Couldn't delete · see the log",
      );
    });
  };
  // Nothing changes while a roaster is in use (docs/spec/roasters.md); the active one can't go.
  const more: MenuItem[] =
    roaster.active || locked
      ? []
      : [
          { label: 'Use this roaster', onSelect: use },
          {
            label: 'Delete',
            destructive: true,
            onSelect: () => {
              setDeleting(true);
            },
          },
        ];
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-title">{roaster.name}</h2>
          {note ? <p className="text-label text-ink-muted">{note}</p> : null}
        </div>
        {more.length > 0 ? <Menu label={`More for ${roaster.name}`} items={more} /> : null}
      </header>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        question="Delete this roaster?"
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
      <ConnectPanel roaster={roaster} />
      <RoasterEditor key={roaster.id} roaster={roaster} locked={locked} />
    </div>
  );
}
