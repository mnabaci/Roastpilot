import type { Roaster } from '@roastpilot/shared';
import type { MenuItem } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useLibraryFiles } from '../../features/use-library-files';
import { useRun } from '../../features/use-run';
import { refusalText } from './roaster-refusal';

/** Use this roaster, Export and Delete, with the one line saying why one was refused. */
export function useRoasterPageActions(
  roaster: Roaster,
  { locked, onDeleted }: { locked: boolean; onDeleted: () => void },
) {
  const { api, logger } = useDeps();
  const run = useRun();
  const files = useLibraryFiles('roasters');
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
  // Actions keep their place either way, the ones that wait disabled with why.
  const waits = roaster.active ? 'active' : locked ? 'locked' : undefined;
  const more: MenuItem[] = [
    // Export only reads the record, so it is always there.
    {
      label: 'Export this roaster',
      onSelect: () => {
        files.exportFile({ kind: 'roasters', ids: [roaster.id] });
      },
    },
    {
      label: 'Delete',
      destructive: true,
      onSelect: () => {
        setDeleting(true);
      },
      ...(waits && {
        disabled: true,
        hint: waits === 'active' ? 'Use another roaster first' : 'Disconnect first',
      }),
    },
  ];
  return { use, remove, more, deleting, setDeleting, problem };
}
