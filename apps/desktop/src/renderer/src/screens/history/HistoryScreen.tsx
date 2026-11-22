import type { RoastId } from '@roastpilot/shared';
import { Button, Menu, RoastList, ScopeLine, SidebarLayout } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { SelectionBar } from '../../features/SelectionBar';
import { useRun } from '../../features/use-run';
import { useSelection } from '../../features/use-selection';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { activeRoaster } from '../../stores/roasters-store';
import { useBeans, useRoast, useRoasters, useSettings } from '../../stores/use-stores';
import {
  inProgressId,
  roastRows,
  roastTitle,
  selectionAfterDelete,
  wasStopped,
} from './history-format';
import { OpenRoast } from './OpenRoast';
import { filterRoasts, NO_FILTER } from './roast-filter';
import { RoastFilters } from './RoastFilters';
import { RoastHeader } from './RoastHeader';
import {
  ACTIVE,
  ALL_ROASTERS,
  hasRoasterScope,
  normalScope,
  roasterOf,
  roasterScopeOptions,
  roastsInScope,
  scopeName,
  scopeShowing,
  type RoasterScope,
} from './roaster-scope';
import { useMakeProfile } from './use-make-profile';
import { useRoastFiles } from './use-roast-files';
import { useRoastList } from './use-roast-list';
import { useSavedRoast } from './use-saved-roast';

/** Saved roasts: pick one, see its numbers and chart, compare with another, delete (docs/spec/ui.md). */
export function HistoryScreen({
  onOpenProfile,
  openFirst,
}: {
  onOpenProfile: (id: string) => void;
  /** The roast to open, from another screen (a bean's roasts); else the newest. */
  openFirst?: RoastId | undefined;
}) {
  const { api } = useDeps();
  const run = useRun();
  const roasts = useRoastList();
  const livePhase = useRoast((s) => s.roast.phase);
  const smoothingS = useSettings((s) => s.settings.chartSmoothingS);
  const unit = useTemperatureUnit();
  const beans = useBeans((s) => s.beans);
  const roasters = useRoasters((s) => s.roasters);
  const activeId = activeRoaster(roasters)?.id;
  const [picked, setPicked] = useState<RoastId | undefined>(openFirst);
  // The active roaster's roasts, like Profiles; it follows the active roaster (docs/spec/ui.md).
  const [scope, setScope] = useState<RoasterScope>(ACTIVE);
  // A roast asked for (a bean's roast, an import) shows, even when it ran on another roaster.
  const [reveal, setReveal] = useState<RoastId | undefined>(openFirst);
  const [compareId, setCompareId] = useState<RoastId>();
  const [deleteError, setDeleteError] = useState<string>();
  const [filter, setFilter] = useState(NO_FILTER);
  // Show preheat stays as you browse History; it isn't saved (docs/spec/ui.md, History).
  const [showPreheat, setShowPreheat] = useState(false);
  // An imported roast opens, even when the filter would hide it.
  const files = useRoastFiles((id) => {
    setFilter(NO_FILTER);
    setPicked(id);
    setReveal(id);
  });
  const profileMaker = useMakeProfile(onOpenProfile);

  const list = roasts ?? [];
  const asked = reveal === undefined ? undefined : list.find((r) => r.id === reveal);
  if (asked) {
    // Once the roast is listed: widen to every roaster if its own isn't the one shown.
    setScope(scopeShowing(normalScope(scope, activeId), asked, activeId));
    setReveal(undefined);
  }
  const liveId = inProgressId(list, livePhase);
  // One roaster and no imports: every roast is its, and there is nothing to choose.
  const scoped = hasRoasterScope(roasters, list);
  const shownScope = scoped ? normalScope(scope, activeId) : ALL_ROASTERS;
  const onRoaster = roastsInScope(list, shownScope, activeId);
  const listed = filterRoasts(onRoaster, filter);
  // "No roasts on Simulator yet", rather than blaming filters that aren't on.
  const emptyRoaster =
    onRoaster.length === 0 ? scopeName(shownScope, roasters, activeId) : undefined;
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

  /** Deletes the ticked roasts; one still roasting stays, and says so. */
  const removeTicked = () => {
    const ids = [...selection.checked];
    setDeleteError(undefined);
    run(
      'history.delete-many-failed',
      async () => {
        let kept = 0;
        for (const id of ids) {
          const deleted = await api.deleteRoast(id);
          if (!deleted.ok) kept += 1;
        }
        selection.done();
        if (kept > 0) setDeleteError("Couldn't delete every roast · one may still be roasting");
        setPicked(undefined);
      },
      { failed: "Couldn't delete the roasts · try again" },
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
      subtitle={
        scoped ? (
          <ScopeLine
            label="Roaster"
            value={shownScope}
            options={roasterScopeOptions(list, roasters, activeId)}
            onChange={(next) => {
              setScope(next);
              setDeleteError(undefined);
            }}
          />
        ) : undefined
      }
      contentLabel="Roast"
      sidebar={
        <>
          <RoastFilters filter={filter} onChange={setFilter} beans={beans} roasts={onRoaster} />
          {selection.selecting ? (
            <SelectionBar
              label="Selected roasts"
              count={selection.checked.size}
              exportAction={
                // A choice of file: a worded menu button, dimmed like Export elsewhere till a tick.
                <Menu
                  label="Export selected"
                  text="Export"
                  disabled={selection.checked.size === 0}
                  items={(['roastpilot', 'csv'] as const).map((format) => ({
                    label: format === 'csv' ? 'CSV' : 'Roastpilot file',
                    onSelect: () => {
                      files.exportRoasts({ format, ids: [...selection.checked] });
                    },
                  }))}
                />
              }
              remove={{
                verb: 'Delete',
                noun: ['roast', 'roasts'],
                detail: "can't be undone",
                onConfirm: removeTicked,
              }}
              onDone={selection.done}
            />
          ) : null}
          {emptyRoaster ? (
            <div className="flex flex-col items-start gap-2 px-1">
              <p className="text-label text-ink-muted">No roasts on {emptyRoaster} yet</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setScope(ALL_ROASTERS);
                }}
              >
                All roasters
              </Button>
            </div>
          ) : (
            <RoastList
              label="Saved roasts"
              items={roastRows(listed, livePhase, unit, {}, beans).map((row, i) => {
                const roast = listed[i];
                // Several roasters' roasts in one list: each says which it ran on.
                return shownScope === ALL_ROASTERS && scoped && roast
                  ? { ...row, aside: roasterOf(roast, roasters) }
                  : row;
              })}
              selectedId={selectedId}
              onSelect={(id) => {
                setPicked(id);
                setDeleteError(undefined);
              }}
              {...(selection.selecting
                ? { checked: selection.checked, onCheck: selection.check }
                : {})}
            />
          )}
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
          stopped={selected.status === 'loaded' && wasStopped(selected.detail)}
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
          emptyText={emptyRoaster ? `No roasts on ${emptyRoaster} yet` : undefined}
          showPreheat={showPreheat}
          onShowPreheat={setShowPreheat}
        />
      </div>
    </SidebarLayout>
  );
}
