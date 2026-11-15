import { roastReport } from '@roastpilot/core';
import { Button } from '@roastpilot/ui';
import { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { useDeps } from '../../app/app-context';
import { RoastReportContent } from '../../features/roast-report/RoastReportContent';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useBeans, useRoast } from '../../stores/use-stores';
import { roastTitle } from '../history/history-format';
import { useRoastList } from '../history/use-roast-list';
import { useSavedRoast } from '../history/use-saved-roast';

/**
 * After cooling: the roast's report, then weights, rating, star and notes over the chart, never a dialog; Done hides it
 * (docs/spec/ui.md, After cooling). Everything here is saved as you enter it and stays in History.
 */
export function FinishedRoastCard() {
  const roast = useRoast((s) => s.roast);
  const currentId = useBeans((s) => s.currentRoastId);
  const view = useDeps().stores.roastView;
  const list = useRoastList();
  const listed = list?.find((r) => r.id === currentId);
  const cached = useStore(view, (s) => s.finished);
  // Until the list loads again, the roast as last listed: leaving Roast doesn't blink the card.
  const saved = list ? listed : cached?.id === currentId ? cached : undefined;
  // Done is per roast and outlives the screen, so the next roast's card shows again.
  const doneId = useStore(view, (s) => s.doneRoastId);
  const shown =
    roast.phase === 'done' && roast.chargedAtMs !== null && saved && doneId !== saved.id
      ? saved
      : undefined;
  // The saved roast with its readings, read only while the card shows; the report follows it.
  const savedRoast = useSavedRoast(shown?.id);
  const report = useMemo(
    () => (savedRoast.status === 'loaded' ? roastReport(savedRoast.detail) : undefined),
    [savedRoast],
  );
  useEffect(() => {
    if (listed) view.setState({ finished: listed });
  }, [listed, view]);
  if (!shown) return null;
  return (
    <section
      aria-label="Roast just finished"
      className="flex flex-col gap-3 rounded-xl bg-surface px-5 py-4.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-heading">Roast just finished</h2>
          <p className="text-label text-ink-muted">{roastTitle(shown.startedAt)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            view.setState({ doneRoastId: shown.id });
          }}
        >
          Done
        </Button>
      </div>
      {report ? (
        <div className="border-b border-border pb-4">
          <RoastReportContent report={report} compact />
        </div>
      ) : null}
      <RoastResultForm key={shown.id} roast={shown} />
    </section>
  );
}
