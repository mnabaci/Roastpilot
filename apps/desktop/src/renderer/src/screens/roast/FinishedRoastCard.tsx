import { Button } from '@roastpilot/ui';
import { useState } from 'react';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useBeans, useRoast } from '../../stores/use-stores';
import { roastTitle } from '../history/history-format';
import { useRoastList } from '../history/use-roast-list';

/**
 * After cooling: weights, rating, star and notes over the chart, never a dialog; Done hides it
 * (docs/spec/ui.md, After cooling). Everything here is saved as you enter it and stays in History.
 */
export function FinishedRoastCard() {
  const roast = useRoast((s) => s.roast);
  const currentId = useBeans((s) => s.currentRoastId);
  const saved = useRoastList()?.find((r) => r.id === currentId);
  // Dismissed per roast, so the next roast's card shows again.
  const [dismissedId, setDismissedId] = useState<number>();
  if (roast.phase !== 'done' || roast.chargedAtMs === null || !saved || dismissedId === saved.id)
    return null;
  return (
    <section
      aria-label="Roast just finished"
      className="flex flex-col gap-3 rounded-xl bg-surface px-5 py-4.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-heading">Roast just finished</h2>
          <p className="text-label text-ink-muted">{roastTitle(saved.startedAt)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDismissedId(saved.id);
          }}
        >
          Done
        </Button>
      </div>
      <RoastResultForm key={saved.id} roast={saved} />
    </section>
  );
}
