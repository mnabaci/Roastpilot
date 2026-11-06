import { batchPlans, expectedRoastedG } from '@roastpilot/core';
import type { BatchPlan } from '@roastpilot/shared';
import { Button, NumberField } from '@roastpilot/ui';
import { useRoasters } from '../../stores/use-stores';
import { activeRoaster } from '../../stores/roasters-store';
import { describePlan, formatGrams } from './batch-format';

/** Order weight in, two plans side by side (docs/spec/batch-and-stock.md). */
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
  const card = (title: string, plan: BatchPlan, warning?: string) => (
    <section aria-label={title} className="flex flex-col gap-1 rounded-xl bg-surface px-4 py-3">
      <h3 className="text-label text-ink-muted">{title}</h3>
      <p className="text-body font-semibold tabular-nums">{describePlan(plan)}</p>
      <p className="text-label text-ink-muted tabular-nums">
        About {formatGrams(expectedRoastedG(order, lossPct))} roasted
      </p>
      {warning ? <p className="text-label text-critical-text">{warning}</p> : null}
      {onPick ? (
        <Button
          size="sm"
          className="mt-1 self-start"
          aria-pressed={picked?.kind === plan.kind}
          onClick={() => {
            onPick(plan);
          }}
        >
          {picked?.kind === plan.kind ? 'Picked' : 'Pick'}
        </Button>
      ) : null}
    </section>
  );
  return (
    <div className="flex flex-col gap-3">
      <NumberField
        label="Order weight"
        unit="g"
        value={orderG}
        onChange={onOrderG}
        className="w-40"
      />
      {plans ? (
        <div className="grid grid-cols-2 gap-3">
          {card('Equal splits', plans.equal)}
          {card(
            'Ideal + leftover',
            plans.ideal,
            plans.idealLeftoverBelowMin ? 'Leftover is below the minimum batch' : undefined,
          )}
        </div>
      ) : null}
    </div>
  );
}
