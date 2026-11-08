import type { RoastId } from '@roastpilot/shared';
import { Button, Menu, RoastList, SidebarLayout } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useBeans, useRoast, useSettings } from '../../stores/use-stores';
import { inProgressId, roastRows, roastTitle, selectionAfterDelete } from './history-format';
import { OpenRoast } from './OpenRoast';
import { filterRoasts, NO_FILTER } from './roast-filter';
import { RoastFilters } from './RoastFilters';
import { RoastHeader } from './RoastHeader';
import { SelectionBar } from './SelectionBar';
import { useMakeProfile } from './use-make-profile';
import { useRoastFiles } from './use-roast-files';
import { useRoastList } from './use-roast-list';
import { useSavedRoast } from './use-saved-roast';
import { useSelection } from './use-selection';

/** Saved roasts: pick one, see its numbers and chart, compare with another, delete (docs/spec/ui.md). */
export function HistoryScreen({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { api } = useDeps();
  const run = useRun();
  const roasts = useRoastList();
  const livePhase = useRoast((s) => s.roast.phase);
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const beans = useBeans((s) => s.beans);
  const [picked, setPicked] = useState<RoastId>();
  const [compareId, setCompareId] = useState<RoastId>();
  const [deleteError, setDeleteError] = useState<string>();
  const [filter, setFilter] = useState(NO_FILTER);
  // Show preheat stays as you browse History; it isn't saved (docs/spec/ui.md, History).
  const [showPreheat, setShowPreheat] = useState(false);
  // An imported roast opens, even when the filter would hide it.
  const files = useRoastFiles((id) => {
    setFilter(NO_FILTER);
    setPicked(id);
  });
  const profileMaker = useMakeProfile(onOpenProfile);

  const list = roasts ?? [];
  const liveId = inProgressId(list, livePhase);
  const listed = filterRoasts(list, filter);
  const selection = useSelection(
    listed.map((r) => r.id),
    list.map((r) => r.id),
  );
  // The picked roast while it's listed, else the newest there.
  const selectedRoast = listed.find((r) => r.id === picked) ?? listed[0];
  const selectedId = selectedRoast?.id;
  const others = list.filter((r) => r.id !== selectedId);
  const compareTo = others.find((r) => r.id === compareId);
  const selected = useSavedRoast(selectedId);
  const compared = useSavedRoast(compareTo?.id);

  const remove = (id: RoastId) => {
    setDeleteError(undefined);
    run(
      'history.delete-failed',
      async () => {
        const deleted = await api.deleteRoast(id);
        if (!deleted.ok) {
          setDeleteError(
            deleted.error.kind === 'in-progress'
              ? 'Still roasting · delete it once it ends'
              : "Couldn't delete this roast · see Logs",
          );
          return;
        }
        // The next one down the list as filtered, so the pick stays on screen.
        setPicked(selectionAfterDelete(listed, id));
      },
      { failed: "Couldn't delete the roast · try again" },
    );
  };

  if (roasts === undefined) return <main className="flex-1" />;
  if (list.length === 0)
    return (
      <main className="flex min-h-0 flex-1 flex-col items-start gap-2 p-6">
        <h1 className="text-title">History</h1>
        <p className="text-body text-ink-muted">
          No roasts yet · each roast saves itself from charge
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={files.importRoasts}>
            Import a Roastpilot file
          </Button>
          <Button size="sm" variant="ghost" onClick={files.importAlog}>
            Import from Artisan
          </Button>
        </div>
      </main>
    );

  const live = selectedId !== undefined && selectedId === liveId;
  const note = profileMaker.noteFor(selectedId);
  return (
    <SidebarLayout
      title="History"
      titleAction={
        <Menu
          label="More for History"
          items={[
            {
              label: 'Export all · Roastpilot file',
              onSelect: () => {
                files.exportRoasts({ format: 'roastpilot' });
              },
            },
            {
              label: 'Export all · CSV',
              onSelect: () => {
                files.exportRoasts({ format: 'csv' });
              },
            },
            { label: 'Import a Roastpilot file', onSelect: files.importRoasts },
            { label: 'Import from Artisan', onSelect: files.importAlog },
            { label: 'Select', onSelect: selection.start },
          ]}
        />
      }
      contentLabel="Roast"
      sidebar={
        <>
          <RoastFilters filter={filter} onChange={setFilter} beans={beans} roasts={list} />
          {selection.selecting ? (
            <SelectionBar
              checked={selection.checked}
              onExport={files.exportRoasts}
              onDone={selection.done}
            />
          ) : null}
          <RoastList
            label="Saved roasts"
            items={roastRows(listed, livePhase, {}, beans)}
            selectedId={selectedId}
            onSelect={(id) => {
              setPicked(id);
              setDeleteError(undefined);
            }}
            {...(selection.selecting
              ? { checked: selection.checked, onCheck: selection.check }
              : {})}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <RoastHeader
          roast={selectedRoast}
          others={others}
          compareId={compareTo?.id}
          onCompare={setCompareId}
          live={live}
          onMakeProfile={profileMaker.make}
          onExport={(id, format) => {
            files.exportRoasts({ format, ids: [id] });
          }}
          onDelete={remove}
        />
        {note ? (
          <p role="status" className="text-label text-ink-muted">
            {note}
          </p>
        ) : null}
        {deleteError ? (
          <p role="alert" className="text-body text-critical-text">
            {deleteError}
          </p>
        ) : null}
        <OpenRoast
          selected={selected}
          compared={compared}
          compareLabel={compareTo ? roastTitle(compareTo.startedAt) : ''}
          live={live}
          beans={beans}
          smoothingS={smoothingS}
          showPreheat={showPreheat}
          onShowPreheat={setShowPreheat}
        />
      </div>
    </SidebarLayout>
  );
}
