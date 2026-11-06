import type { Bean, BatchPlan } from '@roastpilot/shared';
import { Button, NumberField, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { BatchCalculator } from './BatchCalculator';
import { formatGrams } from './batch-format';

const today = () => new Date().toISOString().slice(0, 10);
const FAILED = "Couldn't save the stock · see Logs";

/** New stock: its weight, the plan for it and the date. */
export function AddStockForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  const { api } = useDeps();
  const run = useRun();
  const [orderG, setOrderG] = useState('');
  const [plan, setPlan] = useState<BatchPlan | null>(null);
  const [purchasedAt, setPurchasedAt] = useState(today);
  const [problem, setProblem] = useState<string>();
  const grams = Number(orderG);
  const valid = grams > 0;
  return (
    <section aria-label="Add stock" className="flex flex-col gap-3">
      <h3 className="text-heading">Add stock</h3>
      <BatchCalculator
        orderG={orderG}
        onOrderG={(value) => {
          setOrderG(value);
          setPlan(null);
        }}
        lossPct={bean.avgLossPct}
        picked={plan}
        onPick={setPlan}
      />
      <TextField label="Bought on" value={purchasedAt} onChange={setPurchasedAt} className="w-40" />
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => {
            run('beans.add-stock-failed', async () => {
              const added = await api.addStock({ beanId: bean.id, grams, purchasedAt, plan });
              if (added.ok) onDone();
              else setProblem(FAILED);
            });
          }}
        >
          {valid ? `Add ${formatGrams(grams)}` : 'Add stock'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

/** Stock by hand, when your count says otherwise. */
export function AdjustStockForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  const { api } = useDeps();
  const run = useRun();
  const [green, setGreen] = useState(String(bean.greenG));
  const [roasted, setRoasted] = useState(String(bean.roastedG));
  const [problem, setProblem] = useState<string>();
  const [greenG, roastedG] = [Number(green), Number(roasted)];
  const invalid = (value: string, n: number) => value.trim() === '' || !(n >= 0);
  const valid = !invalid(green, greenG) && !invalid(roasted, roastedG);
  return (
    <section aria-label="Adjust stock" className="flex flex-col gap-3">
      <h3 className="text-heading">Adjust stock</h3>
      <div className="flex gap-3">
        <NumberField label="Green" unit="g" value={green} onChange={setGreen} className="w-32" />
        <NumberField
          label="Roasted"
          unit="g"
          value={roasted}
          onChange={setRoasted}
          className="w-32"
        />
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => {
            run('beans.adjust-stock-failed', async () => {
              const adjusted = await api.adjustStock({ beanId: bean.id, greenG, roastedG });
              if (adjusted.ok) onDone();
              else setProblem(FAILED);
            });
          }}
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
