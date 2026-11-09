import { clampBatch, expectedRoastedG, splitStock } from '@roastpilot/core';
import { Button, cn, NumberField } from '@roastpilot/ui';
import { TriangleAlert } from 'lucide-react';
import { batchCount, describeBatches, formatGrams } from './batch-format';
import { usePlanContext } from './use-plan-context';

/** Common order sizes, one tap each. */
const ORDERS = [
  { label: '1 kg', g: 1000 },
  { label: '2 kg', g: 2000 },
  { label: '5 lb', g: 2268 },
  { label: '5 kg', g: 5000 },
] as const;

/** Every batch as one segment of a bar, to scale; one below the minimum in ember. */
function BatchBar({ batchesG, minG }: { batchesG: readonly number[]; minG: number }) {
  return (
    <div aria-hidden="true" className="flex h-3 gap-0.5">
      {batchesG.map((g, place) => (
        <span
          // Batches repeat their weight: their place in the plan is what tells them apart.
          key={`${String(place)}-${String(g)}`}
          // Data, not layout: each segment is as wide as its share of the order.
          style={{ flexGrow: g, flexBasis: 0 }}
          className={cn('rounded-sm', g < minG ? 'bg-heat' : 'bg-ink-muted')}
        />
      ))}
    </div>
  );
}

/**
 * What an order would make (docs/spec/batch-and-stock.md): the same equal batches a bean's stock
 * gets, around the batch you'd roast it at, on the active roaster. For "what if I bought X?";
 * nothing is saved.
 */
export function BatchCalculator({
  orderG,
  onOrderG,
  batchG,
  onBatchG,
}: {
  /** As typed. */
  orderG: string;
  onOrderG: (value: string) => void;
  /** As typed; empty uses Auto's profile batch, else the roaster's ideal. */
  batchG: string;
  onBatchG: (value: string) => void;
}) {
  const context = usePlanContext();
  if (!context) {
    return <p className="text-body text-ink-muted">Add a roaster to plan batches</p>;
  }
  const { roaster, autoProfileG } = context;
  const sizes = { minG: roaster.batchMinG, maxG: roaster.batchMaxG };
  const order = Number(orderG);
  const typed = Number(batchG);
  const defaultG = autoProfileG ?? roaster.batchIdealG;
  const targetG = clampBatch(typed > 0 ? typed : defaultG, sizes);
  const batches = order > 0 ? splitStock(order, targetG, sizes) : [];
  const short = batches.find((g) => g < roaster.batchMinG);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <NumberField
          label="Order weight"
          unit="g"
          value={orderG}
          onChange={onOrderG}
          className="w-40"
        />
        <div role="group" aria-label="Common orders" className="flex flex-wrap gap-1">
          {ORDERS.map(({ label, g }) => (
            <Button
              key={label}
              size="sm"
              variant="ghost"
              aria-pressed={order === g}
              className={order === g ? 'bg-surface-raised' : 'text-ink-muted hover:text-ink'}
              onClick={() => {
                onOrderG(String(g));
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <NumberField
        label="Batch"
        unit="g"
        value={batchG}
        placeholder={String(defaultG)}
        onChange={onBatchG}
        className="w-40"
        hint={`${autoProfileG === undefined ? "The roaster's ideal" : "Auto's profile batch"} unless you change it · ${formatGrams(roaster.batchMinG)}–${formatGrams(roaster.batchMaxG)}`}
      />
      {batches.length > 0 ? (
        <section
          aria-label="Plan"
          className="flex flex-col gap-3 rounded-xl bg-surface-raised px-4 py-3.5"
        >
          <div className="flex flex-col gap-0.5">
            <p className="text-heading tabular-nums">{batchCount(batches.length)}</p>
            <p className="text-label text-ink-muted tabular-nums">{describeBatches(batches)}</p>
          </div>
          <BatchBar batchesG={batches} minG={roaster.batchMinG} />
          {short === undefined ? null : (
            <p className="flex items-center gap-1.5 text-label text-heat tabular-nums">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              Under one batch · the minimum is {formatGrams(roaster.batchMinG)}
            </p>
          )}
          <p className="text-label text-ink-muted tabular-nums">
            About {formatGrams(expectedRoastedG(order, null))} roasted
          </p>
        </section>
      ) : null}
    </div>
  );
}
