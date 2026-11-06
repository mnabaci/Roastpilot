import type { Roaster } from '@roastpilot/shared';
import { useConnection } from '../../stores/use-stores';
import { ConnectPanel } from './ConnectPanel';
import { RoasterEditor } from './RoasterEditor';
import { modelNote } from './roaster-model';

/** One roaster: connect it, then its record (docs/spec/ui.md, Roasters screen). */
export function RoasterPage({ roaster, onDeleted }: { roaster: Roaster; onDeleted: () => void }) {
  // Records wait while any roaster is in use (docs/spec/roasters.md).
  const locked = useConnection((s) => s.connection.status !== 'disconnected');
  const note = modelNote(roaster);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="truncate text-title">{roaster.name}</h2>
        {note ? <p className="text-label text-ink-muted">{note}</p> : null}
      </header>
      <ConnectPanel roaster={roaster} />
      <RoasterEditor key={roaster.id} roaster={roaster} locked={locked} onDeleted={onDeleted} />
    </div>
  );
}
