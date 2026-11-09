import { batchPlans, expectedRoastedG } from '@roastpilot/core';
import type { BatchPlan } from '@roastpilot/shared';
import { Button, cn, NumberField } from '@roastpilot/ui';
import { TriangleAlert } from 'lucide-react';
import { useRoasters } from '../../stores/use-stores';
import { activeRoaster } from '../../stores/roasters-store';
import { describePlan, formatGrams } from './batch-format';

/** Common order sizes, one tap each. */
const ORDERS = [
  { label: '1 kg', g: 1000 },
  { label: '2 kg', g: 2000 },
  { label: '5 lb', g: 2268 },
  { label: '5 kg', g: 5000 },
] as const;

/** The batches grouped by weight, biggest group first: `12 × 384 g · 1 × 392 g`. */
function groupedBatches(batchesG: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const g of batchesG) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${String(n)} × ${formatGrams(g)}`)
    .join(' · ');
}

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
 * Order weight in, two plans side by side (docs/spec/batch-and-stock.md): how many batches, their
 * weights in a line and to scale in a bar, and, in Add bean and Add stock, a Pick that saves one
 * to the bean.
 */
export function BatchCalculator({
  orderG,
  onOrderG,
  lossPct = null,
  picked,
  onPick,
}: {
  /** As typed. */
  orderG: string;
  onOrderG: (value: string) => void;
  lossPct?: number | null;
  picked?: BatchPlan | null;
  /** Leave out for the plans alone, with nothing to pick for. */
  onPick?: (plan: BatchPlan) => void;
}) {
  const roaster = activeRoaster(useRoasters((s) => s.roasters));
  const order = Number(orderG);
  const plans =
    roaster && order > 0
      ? batchPlans(order, {
          minG: roaster.batchMinG,
          idealG: roaster.batchIdealG,
          maxG: roaster.batchMaxG,
        })
      : undefined;
  const minG = roaster?.batchMinG ?? 0;
  const card = (title: string, plan: BatchPlan) => {
    const isPicked = picked?.kind === plan.kind;
    const short = plan.batchesG.filter((g) => g < minG);
    const count = plan.batchesG.length;
    return (
      <section
        aria-label={title}
        className={cn(
          'flex flex-col gap-3 rounded-xl px-4 py-3.5',
          isPicked ? 'bg-heat-tint' : 'bg-surface-raised',
        )}
      >
        <div className="flex flex-col gap-0.5">
          <h3 className="text-label text-ink-muted">{title}</h3>
          <p className="text-heading tabular-nums">
            {count} {count === 1 ? 'batch' : 'batches'}
          </p>
          {/* The plan in words for screen readers; the line under it says the same in groups. */}
          <p className="sr-only">{describePlan(plan)}</p>
          <p aria-hidden="true" className="text-label text-ink-muted tabular-nums">
            {groupedBatches(plan.batchesG)}
          </p>
        </div>
        <BatchBar batchesG={plan.batchesG} minG={minG} />
        {short.length > 0 ? (
          <p className="flex items-center gap-1.5 text-label text-heat tabular-nums">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
            {formatGrams(short[0] ?? 0)} leftover · below the minimum
          </p>
        ) : null}
        {onPick ? (
          <Button
            size="sm"
            className="mt-auto self-start"
            aria-pressed={isPicked}
            onClick={() => {
              onPick(plan);
            }}
          >
            {isPicked ? 'Picked' : 'Pick'}
          </Button>
        ) : null}
      </section>
    );
  };
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
      <p className="text-label text-ink-muted tabular-nums">
        {roaster
          ? [
              `${roaster.name}: ${formatGrams(roaster.batchMinG)}–${formatGrams(roaster.batchMaxG)} a batch, ${formatGrams(roaster.batchIdealG)} ideal`,
              order > 0 ? `about ${formatGrams(expectedRoastedG(order, lossPct))} roasted` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Add a roaster to plan batches'}
      </p>
      {plans ? (
        <div className="grid grid-cols-2 gap-3">
          {card('Equal splits', plans.equal)}
          {card('Ideal + leftover', plans.ideal)}
        </div>
      ) : null}
    </div>
  );
}
