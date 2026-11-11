import type { Bean } from '@roastpilot/shared';
import { Button, NumberField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { formatGrams } from './batch-format';
import { isStockDate, today } from './stock-date';
import { FAILED } from './stock-change';
import { StockDateField, StockFormFooter, ThenLine } from './stock-form-parts';

/**
 * New stock: its weight and the date, and what the green stock then splits into (docs/spec/
 * batch-and-stock.md). The plan is worked out from the stock, so there is nothing to pick.
 */
export function AddStockForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  const { api } = useDeps();
  const run = useRun();
  const [orderG, setOrderG] = useState('');
  const [purchasedAt, setPurchasedAt] = useState(() => today());
  const [problem, setProblem] = useState<string>();
  const grams = Number(orderG);
  const valid = grams > 0 && isStockDate(purchasedAt);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <NumberField label="Weight" unit="g" value={orderG} onChange={setOrderG} className="w-40" />
        <StockDateField label="Bought on" value={purchasedAt} onChange={setPurchasedAt} />
      </div>
      {grams > 0 ? <ThenLine bean={bean} greenG={bean.greenG + grams} /> : null}
      <StockFormFooter problem={problem} onCancel={onDone}>
        <Button
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() => {
            run(
              'beans.add-stock-failed',
              async () => {
                const added = await api.addStock({
                  beanId: bean.id,
                  grams,
                  purchasedAt: purchasedAt.trim(),
                });
                if (added.ok) onDone();
                else setProblem(FAILED);
              },
              { failed: "Couldn't add the stock · try again" },
            );
          }}
        >
          {grams > 0 ? `Add ${formatGrams(grams)}` : 'Add stock'}
        </Button>
      </StockFormFooter>
    </div>
  );
}
