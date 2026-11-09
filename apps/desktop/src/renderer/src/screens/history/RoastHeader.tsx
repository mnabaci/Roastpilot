import type { RoastId, RoastSummary } from '@roastpilot/shared';
import { Badge, ConfirmDialog, FilterSelect, Menu } from '@roastpilot/ui';
import { useState } from 'react';
import { roastTitle } from './history-format';
import type { ProfileStyle } from './use-make-profile';

const NONE = 'none';

/**
 * Everything for the open roast in one row (docs/spec/ui.md, History screen): its date with Auto
 * or Manual, Compare,
 * Make profile and "⋯"; the roast being roasted says it is saving instead of the last two.
 */
export function RoastHeader({
  roast,
  others,
  compareId,
  onCompare,
  live,
  stopped,
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
  /** Ended with Stop roast before drop: a Stopped badge after the title. */
  stopped: boolean;
  onMakeProfile: (id: RoastId, style: ProfileStyle) => void;
  onExport: (id: RoastId, format: 'roastpilot' | 'csv') => void;
  onDelete: (id: RoastId) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    // One row that never wraps: when it's tight, Compare's choice gives way first (whole in its
    // tooltip), then Make profile; the title and badges keep their place (docs/spec/ui.md, History).
    <header className="flex min-h-control-sm items-center gap-3">
      <div className="flex min-h-control-sm shrink-0 items-center gap-3">
        <h2 className="text-title whitespace-nowrap">{roast ? roastTitle(roast.startedAt) : ''}</h2>
        {roast === undefined ? null : roast.profileName === null ? (
          <Badge className="shrink-0">Manual</Badge>
        ) : (
          <Badge tone="air" className="shrink-0">
            Auto
          </Badge>
        )}
        {stopped ? <Badge className="shrink-0">Stopped</Badge> : null}
      </div>
      {/* Takes the room that's left, so it shrinks before anything after it does. */}
      <div className="flex min-w-control-sm flex-1 justify-end">
        <FilterSelect
          label="Compare"
          className="max-w-48"
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
      </div>
      {roast === undefined ? null : live ? (
        <p className="min-w-0 truncate text-label text-ink-muted">Saving as it roasts</p>
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
