import type { Roaster } from '@roastpilot/shared';
import { cn, ConfirmDialog, Menu, type MenuItem } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useConnection } from '../../stores/use-stores';
import { ConnectPanel } from './ConnectPanel';
import { RoasterEditor } from './RoasterEditor';
import { modelNote } from './roaster-model';
import { refusalText } from './roaster-refusal';
import { PAGE_WIDTH } from '../../lib/page-width';

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
    setProblem(undefined);
    run(
      'roasters.activate-failed',
      async () => {
        const set = await api.setActiveRoaster(roaster.id);
        if (set.ok) return;
        logger.warn('roasters.refused', { ...set.error });
        setProblem(refusalText(set.error, 'switch roasters'));
      },
      { failed: "Couldn't switch roasters · try again" },
    );
  };
  const remove = () => {
    setProblem(undefined);
    run(
      'roasters.delete-failed',
      async () => {
        const result = await api.deleteRoaster(roaster.id);
        if (result.ok) {
          onDeleted();
          return;
        }
        logger.warn('roasters.refused', { ...result.error });
        setProblem(
          result.error.kind === 'has-roasts'
            ? 'It has saved roasts or profiles · it stays'
            : refusalText(result.error, 'delete'),
        );
      },
      { failed: "Couldn't delete the roaster · try again" },
    );
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
    <div className={cn('flex flex-col gap-6', PAGE_WIDTH)}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {/* As tall as the sidebar's title row, so both titles share a line. */}
          <div className="flex min-h-control-sm min-w-0 items-center">
            <h2 className="truncate text-title">{roaster.name}</h2>
          </div>
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
