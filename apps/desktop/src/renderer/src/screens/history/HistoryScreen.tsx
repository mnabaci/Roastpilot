import type { RoastId } from '@roastpilot/shared';
import { Button, EventTable, RoastList, SelectField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useBeans, useRoast, useSettings } from '../../stores/use-stores';
import { DeleteRoast } from './DeleteRoast';
import { MakeProfile } from './MakeProfile';
import { ALL, filterRoasts, MANUAL, NO_BEAN, NO_FILTER, profileOptions } from './roast-filter';
import { inProgressId, roastRows, roastTitle, selectionAfterDelete } from './history-format';
import { SavedRoastChart } from './SavedRoastChart';
import { SavedRoastStats } from './SavedRoastStats';
import { eventRows } from './event-rows';
import { useRoastList } from './use-roast-list';
import { useSavedRoast } from './use-saved-roast';

const NONE = 'none';

/** Saved roasts: pick one, see its numbers and chart, compare with another, delete (docs/spec/ui.md). */
export function HistoryScreen({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { api } = useDeps();
  const run = useRun();
  const roasts = useRoastList();
  const livePhase = useRoast((s) => s.roast.phase);
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const [picked, setPicked] = useState<RoastId>();
  const [compareId, setCompareId] = useState<string>(NONE);
  const [deleteError, setDeleteError] = useState<string>();
  const [filter, setFilter] = useState(NO_FILTER);
  const beans = useBeans((s) => s.beans);

  const list = roasts ?? [];
  const liveId = inProgressId(list, livePhase);
  const listed = filterRoasts(list, filter);
  // The picked roast while it's listed, else the newest there.
  const selectedId = listed.some((r) => r.id === picked) ? picked : listed[0]?.id;
  const others = list.filter((r) => r.id !== selectedId);
  const compareTo = others.find((r) => String(r.id) === compareId);
  const selected = useSavedRoast(selectedId);
  const compared = useSavedRoast(compareTo?.id);
  const compareLabel = compareTo ? roastTitle(compareTo.startedAt) : '';

  const remove = (id: RoastId) => {
    setDeleteError(undefined);
    run('history.delete-failed', async () => {
      const deleted = await api.deleteRoast(id);
      if (!deleted.ok) {
        setDeleteError(
          deleted.error.kind === 'in-progress'
            ? 'Still roasting · delete it once it ends'
            : "Couldn't delete this roast · see Logs",
        );
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
      <div className="flex min-h-0 w-72 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-title">History</h1>
          <Button
            size="sm"
            aria-pressed={filter.favourites}
            className={filter.favourites ? 'bg-heat-tint text-heat' : undefined}
            onClick={() => {
              setFilter({ ...filter, favourites: !filter.favourites });
            }}
          >
            Favourites
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Bean"
            value={filter.bean}
            options={[
              { value: ALL, label: 'All' },
              { value: NO_BEAN, label: 'No bean' },
              ...beans.map((b) => ({ value: String(b.id), label: b.name })),
            ]}
            onChange={(bean) => {
              setFilter({ ...filter, bean });
            }}
          />
          <SelectField
            label="Profile"
            value={filter.profile}
            options={[
              { value: ALL, label: 'All' },
              { value: MANUAL, label: 'Manual' },
              ...profileOptions(list),
            ]}
            onChange={(profile) => {
              setFilter({ ...filter, profile });
            }}
          />
        </div>
        <RoastList
          label="Saved roasts"
          items={roastRows(listed, livePhase, {}, beans)}
          selectedId={selectedId}
          onSelect={(id) => {
            setPicked(id);
            setDeleteError(undefined);
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
          {selectedId === undefined ? null : selectedId === liveId ? (
            <p className="flex h-control-sm items-center text-label text-ink-muted">
              Saving as it roasts
            </p>
          ) : (
            <DeleteRoast
              key={selectedId}
              onDelete={() => {
                remove(selectedId);
              }}
            />
          )}
        </div>
        {deleteError ? (
          <p role="alert" className="text-body text-critical-text">
            {deleteError}
          </p>
        ) : null}
        {selected.status === 'failed' ? (
          <p role="alert" className="text-body text-critical-text">
            Couldn't open this roast · see Logs
          </p>
        ) : selected.status === 'loaded' ? (
          <>
            <SavedRoastStats roast={selected.detail} />
            <RoastResultForm key={selected.detail.id} roast={selected.detail} />
            <SavedRoastChart
              detail={selected.detail}
              compare={compared.status === 'loaded' ? compared.detail : undefined}
              compareLabel={compareLabel}
              smoothingS={smoothingS}
            />
            <EventTable rows={eventRows(selected.detail)} />
            {selectedId === liveId ? null : (
              <MakeProfile
                key={selected.detail.id}
                roastId={selected.detail.id}
                onOpenProfile={onOpenProfile}
              />
            )}
          </>
        ) : (
          <p className="text-label text-ink-muted">Loading…</p>
        )}
      </section>
    </main>
  );
}
