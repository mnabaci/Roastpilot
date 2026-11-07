import type { RoastId, RoastSummary } from '@roastpilot/shared';
import { ConfirmDialog, FilterSelect, Menu } from '@roastpilot/ui';
import { useState } from 'react';
import { roastTitle } from './history-format';
import type { ProfileStyle } from './use-make-profile';

const NONE = 'none';

/**
 * Everything for the open roast in one row (docs/spec/ui.md, History screen): its date, Compare,
 * Make profile and "⋯"; the roast being roasted says it is saving instead of the last two.
 */
export function RoastHeader({
  roast,
  others,
  compareId,
  onCompare,
  live,
  onMakeProfile,
  onExport,
  onDelete,
}: {
  roast: RoastSummary | undefined;
  /** The roasts it can be compared with. */
  others: readonly RoastSummary[];
  /** The compared roast's id, if one is picked. */
  compareId: RoastId | undefined;
  onCompare: (id: RoastId | undefined) => void;
  live: boolean;
  onMakeProfile: (id: RoastId, style: ProfileStyle) => void;
  onExport: (id: RoastId, format: 'roastpilot' | 'csv') => void;
  onDelete: (id: RoastId) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <header className="flex min-h-control-sm flex-wrap items-center gap-3">
      <h2 className="mr-auto text-title">{roast ? roastTitle(roast.startedAt) : ''}</h2>
      <FilterSelect
        label="Compare"
        allValue={NONE}
        value={compareId === undefined ? NONE : String(compareId)}
        options={[
          { value: NONE, label: 'None' },
          ...others.map((r) => ({ value: String(r.id), label: roastTitle(r.startedAt) })),
        ]}
        onChange={(value) => {
          onCompare(value === NONE ? undefined : Number(value));
        }}
      />
      {roast === undefined ? null : live ? (
        <p className="text-label text-ink-muted">Saving as it roasts</p>
      ) : (
        <>
          <Menu
            label="Make profile"
            text="Make profile"
            items={[
              {
                label: 'Step profile',
                onSelect: () => {
                  onMakeProfile(roast.id, 'steps');
                },
              },
              {
                label: 'Curve profile',
                onSelect: () => {
                  onMakeProfile(roast.id, 'curve');
                },
              },
            ]}
          />
          <Menu
            label="More for this roast"
            items={[
              {
                label: 'Export · Roastpilot file',
                onSelect: () => {
                  onExport(roast.id, 'roastpilot');
                },
              },
              {
                label: 'Export · CSV',
                onSelect: () => {
                  onExport(roast.id, 'csv');
                },
              },
              {
                label: 'Delete',
                destructive: true,
                onSelect: () => {
                  setDeleting(true);
                },
              },
            ]}
          />
          <ConfirmDialog
            open={deleting}
            onOpenChange={setDeleting}
            question="Delete this roast?"
            detail="can't be undone"
            confirmLabel="Delete"
            destructive
            onConfirm={() => {
              onDelete(roast.id);
            }}
          />
        </>
      )}
    </header>
  );
}
