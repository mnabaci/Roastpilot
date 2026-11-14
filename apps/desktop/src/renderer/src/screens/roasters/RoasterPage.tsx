import type { Roaster } from '@roastpilot/shared';
import { Button, cn, ConfirmDialog, Menu, type MenuItem } from '@roastpilot/ui';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useLibraryFiles } from '../../features/use-library-files';
import { useRun } from '../../features/use-run';
import { useConnection } from '../../stores/use-stores';
import { ConnectPanel } from './ConnectPanel';
import { EditActions } from '../../features/EditActions';
import { RoasterEditor } from './RoasterEditor';
import { WiringCard } from './WiringCard';
import { useRoasterDraft } from './use-roaster-draft';
import { WaitingButton } from '../../features/WaitingButton';
import { useConnectControls } from './use-connect-controls';
import { modelNote } from './roaster-model';
import { refusalText } from './roaster-refusal';
import { PAGE_WIDTH } from '../../lib/page-width';

/** One roaster: connect it, then its record (docs/spec/ui.md, Roasters screen). */
export function RoasterPage({ roaster, onDeleted }: { roaster: Roaster; onDeleted: () => void }) {
  const { api, logger } = useDeps();
  const run = useRun();
  // Records wait while any roaster is in use (docs/spec/roasters.md).
  const locked = useConnection((s) => s.connection.status !== 'disconnected');
  const note = modelNote(roaster);
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<string>();
  const files = useLibraryFiles('roasters');
  const connect = useConnectControls(roaster);
  const record = useRoasterDraft(roaster);
  const [editing, setEditing] = useState(false);
  const use = () => {
    setProblem(undefined);
    run(
      'roasters.activate-failed',
      async () => {
        const set = await api.setActiveRoaster(roaster.id);
        if (set.ok) return;
        logger.warn('roasters.refused', { ...set.error });
        setProblem(refusalText(set.error, 'switch roasters'));
      },
      { failed: "Couldn't switch roasters · try again" },
    );
  };
  const remove = () => {
    setProblem(undefined);
    run(
      'roasters.delete-failed',
      async () => {
        const result = await api.deleteRoaster(roaster.id);
        if (result.ok) {
          onDeleted();
          return;
        }
        logger.warn('roasters.refused', { ...result.error });
        setProblem(
          result.error.kind === 'has-roasts'
            ? 'It has saved roasts or profiles · it stays'
            : refusalText(result.error, 'delete'),
        );
      },
      { failed: "Couldn't delete the roaster · try again" },
    );
  };
  // Nothing changes while a roaster is in use (docs/spec/roasters.md); the active one can't go.
  // Actions keep their place either way, the ones that wait disabled with why.
  const waits = roaster.active ? 'active' : locked ? 'locked' : undefined;
  const more: MenuItem[] = [
    // Export only reads the record, so it is always there.
    {
      label: 'Export this roaster',
      onSelect: () => {
        files.exportFile({ kind: 'roasters', ids: [roaster.id] });
      },
    },
    {
      label: 'Delete',
      destructive: true,
      onSelect: () => {
        setDeleting(true);
      },
      ...(waits && {
        disabled: true,
        hint: waits === 'active' ? 'Use another roaster first' : 'Disconnect first',
      }),
    },
  ];
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
                onClick={use}
              >
                Use this roaster
              </WaitingButton>
            )}
            {connect.idle || connect.connecting || connect.otherInUse ? (
              <WaitingButton
                reason={
                  connect.otherInUse
                    ? `Disconnect ${connect.otherName} first`
                    : !connect.ready && !connect.connecting
                      ? connect.target === null
                        ? 'Choose a port first'
                        : 'Plug the roaster in, then Refresh'
                      : undefined
                }
                size="sm"
                variant="primary"
                disabled={!connect.ready || connect.connecting || connect.otherInUse}
                aria-busy={connect.connecting}
                icon={
                  connect.connecting ? (
                    <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                  ) : undefined
                }
                onClick={connect.connect}
              >
                {connect.connecting ? 'Connecting…' : 'Connect'}
              </WaitingButton>
            ) : connect.inUse ? (
              <Button size="sm" onClick={connect.disconnect}>
                Disconnect
              </Button>
            ) : null}
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
            <Menu label={`More for ${roaster.name}`} items={more} />
          </div>
        )}
      </header>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        question="Delete this roaster?"
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
      />
      <ConnectPanel controls={connect} />
      {roaster.wiring ? <WiringCard roaster={{ ...roaster, wiring: roaster.wiring }} /> : null}
      <RoasterEditor roaster={roaster} state={record} editing={editing} />
    </div>
  );
}
