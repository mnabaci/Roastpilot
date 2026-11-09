import { stockSummary, stockTimeline } from '@roastpilot/core';
import type { Bean, StockMovement } from '@roastpilot/shared';
import { Button, CollapsibleCard, StockChart } from '@roastpilot/ui';
import { useEffect, useState } from 'react';
import { useDeps } from '../../app/app-context';
import { formatGrams } from './batch-format';
import {
  boughtTimes,
  lasts,
  signedGrams,
  stockDay,
  stockKind,
  stockLine,
  stockMs,
  stockWhat,
} from './stock-history-format';

/** Rows the list shows before Show all. */
const FIRST_ROWS = 6;

/** The bean's stock movements, read again whenever its stock changes. */
function useStockHistory(bean: Bean): StockMovement[] | undefined {
  const { api } = useDeps();
  const [movements, setMovements] = useState<StockMovement[]>();
  const { id, greenG, roastedG } = bean;
  useEffect(() => {
    let live = true;
    // A history that can't be read shows as none; main has logged why.
    const show = (read: StockMovement[]) => {
      if (live) setMovements(read);
    };
    api.stockHistory(id).then(
      (read) => {
        show(read.ok ? read.value : []);
      },
      () => {
        show([]);
      },
    );
    return () => {
      live = false;
    };
  }, [api, id, greenG, roastedG]);
  return movements;
}

/**
 * How the bean's green stock moved (docs/spec/batch-and-stock.md, Stock history): what it adds
 * up to, the stock over time, and every purchase, roast and adjustment, newest first. The bean's
 * own, whichever roaster or profile roasted it.
 */
export function StockHistory({
  bean,
  nowMs: fixedNowMs,
}: {
  bean: Bean;
  /** Today, for tests and screenshots; else when the card first showed. */
  nowMs?: number;
}) {
  const movements = useStockHistory(bean);
  const [shownAtMs] = useState(() => Date.now());
  const nowMs = fixedNowMs ?? shownAtMs;
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  if (movements === undefined) return null;
  const summary = stockSummary(movements, bean.greenG, nowMs);
  const steps = stockTimeline(movements, bean.greenG);
  const newest = [...steps].reverse();
  const rows = all ? newest : newest.slice(0, FIRST_ROWS);
  const day = (at: string) => stockDay(at, nowMs);
  const first = steps[0];
  const facts = [
    {
      label: 'Bought',
      value:
        summary.timesBought === 0
          ? null
          : `${boughtTimes(summary.timesBought)} · ${formatGrams(summary.boughtG)}`,
    },
    {
      label: 'Roasted',
      value:
        summary.roasts === 0
          ? null
          : `${String(summary.roasts)} ${summary.roasts === 1 ? 'roast' : 'roasts'} · ${formatGrams(summary.usedG)}`,
    },
    {
      label: 'Pace',
      value: summary.weeklyUseG === null ? null : `${formatGrams(summary.weeklyUseG)} a week`,
    },
    { label: 'Lasts', value: summary.weeksLeft === null ? null : lasts(summary.weeksLeft) },
  ];
  return (
    <CollapsibleCard
      title="Stock history"
      summary={stockLine(summary)}
      open={open}
      onOpenChange={setOpen}
    >
      {first === undefined ? (
        <p className="text-label text-ink-muted">
          Adjust stock or roast this bean, and its history starts here
        </p>
      ) : (
        <div className="@container flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 @xl:grid-cols-4">
            {facts.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-label text-ink-muted">{label}</dt>
                <dd className="mt-0.5 text-body text-ink tabular-nums">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <StockChart
            label={`Green stock from ${formatGrams(first.greenAfterG)} on ${day(first.at)} to ${formatGrams(bean.greenG)} today`}
            points={steps.map((step) => ({
              atMs: stockMs(step.at),
              valueG: step.greenAfterG,
              date: day(step.at),
              what: stockWhat(step),
            }))}
            lowG={bean.lowStockG}
            nowMs={nowMs}
            formatGrams={formatGrams}
          />
          <div className="flex flex-col gap-2">
            <table
              aria-label="Stock movements"
              className="w-full border-collapse text-label tabular-nums"
            >
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="pb-2 text-left font-medium">
                    Date
                  </th>
                  <th scope="col" className="pb-2 text-left font-medium">
                    What
                  </th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Green
                  </th>
                  <th scope="col" className="pb-2 text-right font-medium">
                    Green after
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((step, index) => (
                  <tr
                    // Newest first; two movements can share a time.
                    key={`${String(index)}-${step.at}`}
                    className="border-t border-border text-ink"
                  >
                    <td className="py-2 text-ink-muted">{day(step.at)}</td>
                    <th scope="row" className="py-2 text-left font-normal">
                      {stockKind(step)}
                    </th>
                    <td className="py-2 text-right">{signedGrams(step.greenG)}</td>
                    <td className="py-2 text-right">{formatGrams(step.greenAfterG)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {newest.length > FIRST_ROWS ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  setAll(!all);
                }}
              >
                {all ? 'Show fewer' : `Show all ${String(newest.length)}`}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
