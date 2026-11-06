import type { RoastId } from '@roastpilot/shared';
import {
  Button,
  cn,
  ConfirmDialog,
  EventTable,
  FilterSelect,
  Menu,
  RoastList,
  SidebarLayout,
} from '@roastpilot/ui';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useBeans, useRoast, useSettings } from '../../stores/use-stores';
import { useMakeProfile } from './use-make-profile';
import { useRoastFiles } from './use-roast-files';
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
  const [deleting, setDeleting] = useState(false);
  const files = useRoastFiles(setPicked);
  const profileMaker = useMakeProfile(onOpenProfile);

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
  const fileMessage = files.message ? (
    <p
      {...(files.message.problem ? { role: 'alert' } : {})}
      className={cn('text-label', files.message.problem ? 'text-critical-text' : 'text-ink-muted')}
    >
      {files.message.text}
    </p>
  ) : null;
  if (list.length === 0)
    return (
      <main className="flex min-h-0 flex-1 flex-col items-start gap-2 p-6">
        <h1 className="text-title">History</h1>
        <p className="text-body text-ink-muted">
          No roasts yet · each roast saves itself from charge
        </p>
        <Button size="sm" onClick={files.importAlog}>
          Import from Artisan
        </Button>
        {fileMessage}
      </main>
    );

  const selectedRoast = list.find((r) => r.id === selectedId);
  const live = selectedId !== undefined && selectedId === liveId;
  return (
    <SidebarLayout
      title="History"
      titleAction={
        <Menu
          label="More for History"
          items={[
            { label: 'Export CSV', onSelect: files.exportCsv },
            { label: 'Import from Artisan', onSelect: files.importAlog },
          ]}
        />
      }
      contentLabel="Roast"
      sidebar={
        <>
          {fileMessage}
          {/* One row of filters; a chip turns ember while it filters. */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              aria-label="Favourites only"
              aria-pressed={filter.favourites}
              icon={
                <Star
                  aria-hidden="true"
                  className={filter.favourites ? 'fill-current' : undefined}
                />
              }
              className={cn('shrink-0', filter.favourites && 'bg-heat-tint text-heat')}
              onClick={() => {
                setFilter({ ...filter, favourites: !filter.favourites });
              }}
            />
            <FilterSelect
              label="Bean"
              className="flex-1"
              allValue={ALL}
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
            <FilterSelect
              label="Profile"
              className="flex-1"
              allValue={ALL}
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
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Everything for this roast in one row at the top. */}
        <header className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-title">
            {selectedRoast ? roastTitle(selectedRoast.startedAt) : ''}
          </h2>
          <FilterSelect
            label="Compare"
            allValue={NONE}
            value={compareTo ? compareId : NONE}
            options={[
              { value: NONE, label: 'None' },
              ...others.map((r) => ({ value: String(r.id), label: roastTitle(r.startedAt) })),
            ]}
            onChange={setCompareId}
          />
          {selectedId === undefined ? null : live ? (
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
                      profileMaker.make(selectedId, 'steps');
                    },
                  },
                  {
                    label: 'Curve profile',
                    onSelect: () => {
                      profileMaker.make(selectedId, 'curve');
                    },
                  },
                ]}
              />
              <Menu
                label="More for this roast"
                items={[
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
                  remove(selectedId);
                }}
              />
            </>
          )}
        </header>
        {profileMaker.note ? (
          <p role="status" className="text-label text-ink-muted">
            {profileMaker.note}
          </p>
        ) : null}
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
          </>
        ) : selected.status === 'none' ? (
          <p className="text-body text-ink-muted">No roasts match these filters</p>
        ) : (
          <p className="text-label text-ink-muted">Loading…</p>
        )}
      </div>
    </SidebarLayout>
  );
}
