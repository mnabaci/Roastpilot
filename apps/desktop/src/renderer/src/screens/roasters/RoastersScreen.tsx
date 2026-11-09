import type { RoasterId } from '@roastpilot/shared';
import { Badge, Button, Menu, NavList, SidebarLayout } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { SelectionBar } from '../../features/SelectionBar';
import { useLibraryFiles } from '../../features/use-library-files';
import { useRun } from '../../features/use-run';
import { useSelection } from '../../features/use-selection';
import { useToast } from '../../features/use-toast';
import { activeRoaster } from '../../stores/roasters-store';
import { useConnection, useRoasters } from '../../stores/use-stores';
import { AddRoaster } from './AddRoaster';
import { RoasterPage } from './RoasterPage';
import { modelNote } from './roaster-model';

type Open = { kind: 'roaster'; id: RoasterId | undefined } | { kind: 'add' };

/** The roaster records, one open to connect and edit (docs/spec/ui.md, Roasters screen). */
export function RoastersScreen() {
  const { api, logger } = useDeps();
  const run = useRun();
  const toast = useToast();
  const roasters = useRoasters((s) => s.roasters);
  // Opens on the active roaster, which is the one in use while connected.
  const [open, setOpen] = useState<Open>({ kind: 'roaster', id: undefined });
  const shown =
    open.kind === 'roaster'
      ? (roasters.find((r) => r.id === open.id) ?? activeRoaster(roasters))
      : undefined;
  const openRoaster = (id: RoasterId | undefined) => {
    setOpen({ kind: 'roaster', id });
  };
  const files = useLibraryFiles('roasters', (id) => {
    if (typeof id === 'number') openRoaster(id);
  });
  // Nothing changes while a roaster is in use, and the active one can't go (docs/spec/roasters.md):
  // it isn't ticked, and while connected the bar only exports.
  const connected = useConnection((s) => s.connection.status !== 'disconnected');
  const selection = useSelection(
    roasters.filter((r) => !r.active).map((r) => r.id),
    roasters.map((r) => r.id),
  );
  const deleteTicked = () => {
    const ids = [...selection.checked];
    run(
      'roasters.delete-many-failed',
      async () => {
        let kept = 0;
        for (const id of ids) {
          const result = await api.deleteRoaster(id);
          if (!result.ok) {
            kept += 1;
            logger.warn('roasters.refused', { ...result.error });
          }
        }
        selection.done();
        if (kept > 0)
          toast(
            'error',
            `Couldn't delete ${String(kept)} ${kept === 1 ? 'roaster' : 'roasters'} · they have saved roasts or profiles`,
          );
        else
          toast(
            'success',
            `Deleted ${String(ids.length)} ${ids.length === 1 ? 'roaster' : 'roasters'}`,
          );
      },
      { failed: "Couldn't delete the roasters · try again" },
    );
  };
  return (
    <SidebarLayout
      title="Roasters"
      titleAction={
        <Menu
          label="More for Roasters"
          items={[
            {
              label: 'Export all',
              onSelect: () => {
                files.exportFile({ kind: 'roasters' });
              },
            },
            { label: 'Import a Roastpilot file', onSelect: files.importFile },
            { label: 'Select', onSelect: selection.start },
          ]}
        />
      }
      contentLabel={open.kind === 'add' ? 'Add roaster' : 'Roaster'}
      sidebar={
        <>
          {selection.selecting ? (
            <SelectionBar
              label="Selected roasters"
              count={selection.checked.size}
              exportAction={() => {
                files.exportFile({ kind: 'roasters', ids: [...selection.checked] });
              }}
              remove={
                connected
                  ? undefined
                  : {
                      verb: 'Delete',
                      noun: ['roaster', 'roasters'],
                      detail: 'one with saved roasts or profiles stays',
                      onConfirm: deleteTicked,
                    }
              }
              onDone={selection.done}
            />
          ) : null}
          <NavList
            label="Roasters"
            items={roasters.map((r) => ({
              id: r.id,
              label: r.name,
              detail: selection.selecting && r.active ? 'Active' : modelNote(r),
              locked: r.active,
              badge: r.active ? <Badge tone="air">Active</Badge> : undefined,
            }))}
            openId={shown?.id}
            onOpen={openRoaster}
            {...(selection.selecting
              ? { checked: selection.checked, onCheck: selection.check }
              : {})}
          />
          <Button
            variant="ghost"
            // px-3 like the list rows above, so the icon lines up with their names.
            className="justify-start px-3"
            icon={<Plus aria-hidden="true" />}
            aria-current={open.kind === 'add' ? 'true' : undefined}
            onClick={() => {
              setOpen({ kind: 'add' });
            }}
          >
            Add roaster
          </Button>
        </>
      }
    >
      {open.kind === 'add' ? (
        <AddRoaster onAdded={openRoaster} />
      ) : shown ? (
        <RoasterPage
          key={shown.id}
          roaster={shown}
          onDeleted={() => {
            openRoaster(undefined);
          }}
        />
      ) : null}
    </SidebarLayout>
  );
}
