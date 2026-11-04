import type { RoastId } from '@roastpilot/shared';
import { RoastList, SelectField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useRoast, useSettings } from '../../stores/use-stores';
import { DeleteRoast } from './DeleteRoast';
import { roastRows, roastTitle, selectionAfterDelete } from './history-format';
import { SavedRoastChart } from './SavedRoastChart';
import { SavedRoastStats } from './SavedRoastStats';
import { useRoastList } from './use-roast-list';
import { useSavedRoast } from './use-saved-roast';

const NONE = 'none';

/** Saved roasts: pick one, see its numbers and chart, compare with another, delete (docs/spec/ui.md). */
export function HistoryScreen() {
  const { api } = useDeps();
  const run = useRun();
  const roasts = useRoastList();
  const livePhase = useRoast((s) => s.roast.phase);
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const [picked, setPicked] = useState<RoastId>();
  const [compareId, setCompareId] = useState<string>(NONE);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const list = roasts ?? [];
  // The picked roast while it exists, else the newest.
  const selectedId = list.some((r) => r.id === picked) ? picked : list[0]?.id;
  const others = list.filter((r) => r.id !== selectedId);
  const compareTo = others.find((r) => String(r.id) === compareId);
  const selected = useSavedRoast(selectedId);
  const compared = useSavedRoast(compareTo?.id);
  const compareLabel = compareTo ? roastTitle(compareTo.startedAt) : '';

  const remove = (id: RoastId) => {
    setDeleteFailed(false);
    run('history.delete-failed', async () => {
      const deleted = await api.deleteRoast(id);
      if (!deleted.ok) {
        setDeleteFailed(true);
        return;
      }
      setPicked(selectionAfterDelete(list, id));
    });
  };

  if (roasts === undefined) return <main className="flex-1" />;
  if (list.length === 0)
    return (
      <main className="flex min-h-0 flex-1 flex-col gap-2 p-6">
        <h1 className="text-title">History</h1>
        <p className="text-body text-ink-muted">
          No roasts yet · each roast saves itself from charge
        </p>
      </main>
    );

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[auto_1fr] gap-6 p-6">
      <div className="flex min-h-0 w-72 flex-col gap-4">
        <h1 className="text-title">History</h1>
        <RoastList
          label="Saved roasts"
          items={roastRows(list, livePhase)}
          selectedId={selectedId}
          onSelect={(id) => {
            setPicked(id);
            setDeleteFailed(false);
          }}
        />
      </div>
      <section aria-label="Roast" className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto">
        <div className="flex flex-wrap items-end gap-4">
          <h2 className="mr-auto self-center text-heading">
            {selectedId === undefined
              ? ''
              : roastTitle(list.find((r) => r.id === selectedId)?.startedAt ?? '')}
          </h2>
          <SelectField
            label="Compare with"
            value={compareTo ? compareId : NONE}
            options={[
              { value: NONE, label: 'None' },
              ...others.map((r) => ({ value: String(r.id), label: roastTitle(r.startedAt) })),
            ]}
            onChange={setCompareId}
            disabled={others.length === 0}
            className="w-60"
          />
          {selectedId === undefined ? null : (
            <DeleteRoast
              key={selectedId}
              onDelete={() => {
                remove(selectedId);
              }}
            />
          )}
        </div>
        {deleteFailed ? (
          <p role="alert" className="text-body text-critical-text">
            Couldn't delete this roast · see Logs
          </p>
        ) : null}
        {selected.status === 'failed' ? (
          <p role="alert" className="text-body text-critical-text">
            Couldn't open this roast · see Logs
          </p>
        ) : selected.status === 'loaded' ? (
          <>
            <SavedRoastStats roast={selected.detail} />
            <SavedRoastChart
              detail={selected.detail}
              compare={compared.status === 'loaded' ? compared.detail : undefined}
              compareLabel={compareLabel}
              smoothingS={smoothingS}
            />
          </>
        ) : (
          <p className="text-label text-ink-muted">Loading…</p>
        )}
      </section>
    </main>
  );
}
