import type { Roaster } from '@roastpilot/shared';
import { cn, ConfirmDialog, Menu } from '@roastpilot/ui';
import { useState } from 'react';
import { useConnection } from '../../stores/use-stores';
import { ConnectPanel } from './ConnectPanel';
import { ConnectButton } from './ConnectButton';
import { RecordHeader } from '../../features/RecordHeader';
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
  // An unsaved edit kept from before opens in Edit, so it shows (as on Profiles).
  const [editing, setEditing] = useState(record.edited);
  return (
    <div className={cn('flex flex-col gap-4', PAGE_WIDTH)}>
      <RecordHeader
        name={roaster.name}
        editing={editing}
        note={note}
        edit={{
          name: record.draft.name,
          onName: (name) => {
            record.setDraft({ ...record.draft, name });
          },
          nameError: record.errors.name,
          edited: record.edited,
          onCancel: () => {
            record.cancel();
            setEditing(false);
          },
          onSave: () => {
            record.save(() => {
              setEditing(false);
            });
          },
          canSave: record.canSave && !locked,
        }}
        actions={
          <>
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
          </>
        }
      />
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
