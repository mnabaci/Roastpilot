import { isRoastRunning, type Roaster, type Tc4Wiring } from '@roastpilot/shared';
import { CollapsibleCard } from '@roastpilot/ui';
import { useState } from 'react';
import { activeRoaster } from '../../stores/roasters-store';
import { useConnection, useRoast, useRoasters } from '../../stores/use-stores';
import { LiveInputs } from './LiveInputs';
import { useLiveInputs } from './use-live-inputs';
import { useSaveWiring } from './use-save-wiring';
import { wiringSummary } from './wiring-choices';
import { WiringRows } from './WiringRows';
import { isWaiting, wiringStatus, wiringWait } from './wiring-status';

/**
 * A generic TC4's wiring (docs/spec/roasters.md, Generic TC4): set once when the roaster is built,
 * so it folds to a one-line summary, open by itself until the roaster has a port. Its setting rows
 * save as you pick, also while connected, so a probe can be picked by its live reading; a
 * connected roaster reconnects with the new wiring; nothing changes while a roast or drum cooling
 * runs.
 */
export function WiringCard({ roaster }: { roaster: Roaster & { wiring: Tc4Wiring } }) {
  const active = useRoasters((s) => activeRoaster(s.roasters));
  const busy = useRoast((s) => isRoastRunning(s.roast));
  const wait = wiringWait(
    useRoast((s) => s.roast),
    busy && active && active.id !== roaster.id ? active.name : undefined,
  );
  const connected = useConnection((s) => s.connection.status === 'connected') && roaster.active;
  // Connecting, or lost and retrying: a save reconnects then too.
  const inUse = useConnection((s) => s.connection.status !== 'disconnected') && roaster.active;
  // A new roaster is being wired up: open. Later, folded; this page keeps the choice.
  const [open, setOpen] = useState(roaster.connection === null);
  // Read only while you can see them.
  const live = useLiveInputs(open && connected && !busy);
  const { save, saving, problem } = useSaveWiring(roaster);
  const { wiring } = roaster;
  const disabled = isWaiting(wait) || saving;
  return (
    <CollapsibleCard
      title="Wiring"
      summary={wiringSummary(wiring, roaster.minFanHeatingPct)}
      open={open}
      onOpenChange={setOpen}
    >
      <p className="text-label text-ink-muted">{wiringStatus(wait, inUse)}</p>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      {connected && !busy ? (
        <LiveInputs wiring={wiring} inputs={live.inputs} problem={live.problem} />
      ) : null}
      <WiringRows
        wiring={wiring}
        minFanHeatingPct={roaster.minFanHeatingPct}
        disabled={disabled}
        save={save}
      />
    </CollapsibleCard>
  );
}
