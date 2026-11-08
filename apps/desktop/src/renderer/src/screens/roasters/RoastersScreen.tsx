import type { RoasterId } from '@roastpilot/shared';
import { Badge, Button, Menu, NavList, SidebarLayout } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useLibraryFiles } from '../../features/use-library-files';
import { activeRoaster } from '../../stores/roasters-store';
import { useRoasters } from '../../stores/use-stores';
import { AddRoaster } from './AddRoaster';
import { RoasterPage } from './RoasterPage';
import { modelNote } from './roaster-model';

type Open = { kind: 'roaster'; id: RoasterId | undefined } | { kind: 'add' };

/** The roaster records, one open to connect and edit (docs/spec/ui.md, Roasters screen). */
export function RoastersScreen() {
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
          ]}
        />
      }
      contentLabel={open.kind === 'add' ? 'Add roaster' : 'Roaster'}
      sidebar={
        <>
          <NavList
            label="Roasters"
            items={roasters.map((r) => ({
              id: r.id,
              label: r.name,
              detail: modelNote(r),
              badge: r.active ? <Badge tone="air">Active</Badge> : undefined,
            }))}
            openId={shown?.id}
            onOpen={openRoaster}
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
