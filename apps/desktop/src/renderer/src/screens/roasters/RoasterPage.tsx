import type { Roaster } from '@roastpilot/shared';
import { cn, ConfirmDialog, Menu } from '@roastpilot/ui';
import { useState } from 'react';
import { useConnection } from '../../stores/use-stores';
import { ConnectPanel } from './ConnectPanel';
import { ConnectButton } from './ConnectButton';
import { EditActions } from '../../features/EditActions';
import { RoasterEditor } from './RoasterEditor';
import { WiringCard } from './WiringCard';
import { useRoasterDraft } from './use-roaster-draft';
import { WaitingButton } from '../../features/WaitingButton';
import { useConnectControls } from './use-connect-controls';
import { useRoasterPageActions } from './use-roaster-page-actions';
import { modelNote } from './roaster-model';
import { PAGE_WIDTH } from '../../lib/page-width';

/** One roaster: connect it, then its record (docs/spec/ui.md, Roasters screen). */
export function RoasterPage({ roaster, onDeleted }: { roaster: Roaster; onDeleted: () => void }) {
  // Records wait while any roaster is in use (docs/spec/roasters.md).
  const locked = useConnection((s) => s.connection.status !== 'disconnected');
  const note = modelNote(roaster);
  const actions = useRoasterPageActions(roaster, { locked, onDeleted });
  const connect = useConnectControls(roaster);
  const record = useRoasterDraft(roaster);
  const [editing, setEditing] = useState(false);
  return (
    <div className={cn('flex flex-col gap-4', PAGE_WIDTH)}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {/* As tall as the sidebar's title row, so both titles share a line. */}
          <div className="flex min-h-control-sm min-w-0 items-center">
            <h2 className="truncate text-title">{roaster.name}</h2>
          </div>
          {note ? <p className="text-label text-ink-muted">{note}</p> : null}
        </div>
        {editing ? (
          <EditActions
            onCancel={() => {
              record.cancel();
              setEditing(false);
            }}
            onSave={() => {
              record.save(() => {
                setEditing(false);
              });
            }}
            canSave={record.canSave && !locked}
          />
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {roaster.active ? null : (
              <WaitingButton
                size="sm"
                disabled={locked}
                reason={locked ? 'Disconnect first' : undefined}
                onClick={actions.use}
              >
                Use this roaster
              </WaitingButton>
            )}
            <ConnectButton connect={connect} />
            <WaitingButton
              size="sm"
              disabled={locked}
              reason={locked ? 'Disconnect first' : undefined}
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </WaitingButton>
            <Menu label={`More for ${roaster.name}`} items={actions.more} />
          </div>
        )}
      </header>
      {actions.problem ? (
        <p role="alert" className="text-label text-critical-text">
          {actions.problem}
        </p>
      ) : null}
      <ConfirmDialog
        open={actions.deleting}
        onOpenChange={actions.setDeleting}
        question="Delete this roaster?"
        confirmLabel="Delete"
        destructive
        onConfirm={actions.remove}
      />
      <ConnectPanel controls={connect} />
      {roaster.wiring ? <WiringCard roaster={{ ...roaster, wiring: roaster.wiring }} /> : null}
      <RoasterEditor roaster={roaster} state={record} editing={editing} />
    </div>
  );
}
