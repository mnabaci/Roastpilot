import { lastRoastEndMs, pickPreheatHold } from '@roastpilot/core';
import { PREHEAT_HOLD, type Roaster, type RoastSummary } from '@roastpilot/shared';
import { formatClock, SelectField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useAuto, useRoast } from '../../stores/use-stores';

const LENGTHS = Array.from(
  { length: (PREHEAT_HOLD.maxS - PREHEAT_HOLD.minS) / PREHEAT_HOLD.stepS + 1 },
  (_, i) => PREHEAT_HOLD.minS + i * PREHEAT_HOLD.stepS,
);
const OPTIONS = LENGTHS.map((s) => ({ value: String(s), label: formatClock(s) }));
const BATCH = { first: 'First batch', next: 'Next batch · the drum is still hot' } as const;

/**
 * The preheat hold, before Start and during the preheat (docs/spec/roast-control.md, Roast phases
 * 1.3): the length picked for the batch, which you can change for this roast only; a running hold
 * follows at once. Never saved to the roaster.
 */
export function PreheatHoldField({
  roaster,
  roasts,
}: {
  roaster: Roaster;
  roasts: readonly RoastSummary[];
}) {
  const { api } = useDeps();
  const run = useRun();
  const running = useAuto((s) => s.status.preheatHold);
  const preheating = useRoast((s) => s.roast.phase === 'preheat');
  const [chosenS, setChosenS] = useState<number | null>(null);
  // When the card opened: the 20 min since the last roast are counted from then.
  const [openedAtMs] = useState(Date.now);
  // Before the preheat, what main will pick when it starts; during it, what it runs.
  const picked = pickPreheatHold(roaster.tuning, lastRoastEndMs(roasts, roaster.id), openedAtMs);
  if (preheating && running === null) return null;
  const batch = running?.batch ?? picked.batch;
  const shownS = running?.s ?? chosenS ?? picked.s;
  const choose = (value: string) => {
    const seconds = Number(value);
    // Picking the batch's own length goes back to it.
    const holdS = !running && seconds === picked.s ? null : seconds;
    setChosenS(holdS);
    run('auto.hold-failed', () => api.autoSetPreheatHold({ holdS }), {
      failed: "Couldn't change the hold · try again",
    });
  };
  return (
    <div className="flex items-center justify-between gap-3">
      {/* Two lines, so neither wraps beside the select in the narrow panel. */}
      <div className="flex min-w-0 flex-col">
        <p className="text-body text-ink">Preheat hold</p>
        <p className="text-label text-ink-muted">{BATCH[batch]}</p>
      </div>
      <SelectField
        label="Preheat hold"
        hideLabel
        numeric
        value={String(shownS)}
        options={OPTIONS}
        onChange={choose}
        className="w-24 shrink-0"
      />
    </div>
  );
}
