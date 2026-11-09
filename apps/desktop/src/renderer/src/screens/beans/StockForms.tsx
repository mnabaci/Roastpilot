import type { Bean } from '@roastpilot/shared';
import { Button, NumberField, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { formatGrams, planLine } from './batch-format';
import { beanPlan } from './bean-plan';
import { usePlanContext } from './use-plan-context';
import { isPurchaseDate, today } from './purchase-date';

const FAILED = "Couldn't save the stock · see Logs";

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
  const dated = isPurchaseDate(purchasedAt);
  const valid = grams > 0 && dated;
  const planContext = usePlanContext();
  const after = bean.greenG + (grams > 0 ? grams : 0);
  return (
    <section aria-label="Add stock" className="flex flex-col gap-3">
      <h3 className="text-heading">Add stock</h3>
      <div className="flex flex-wrap items-start gap-3">
        <NumberField label="Weight" unit="g" value={orderG} onChange={setOrderG} className="w-40" />
        <div className="flex flex-col gap-1">
          <TextField
            label="Bought on"
            value={purchasedAt}
            onChange={setPurchasedAt}
            aria-invalid={!dated || undefined}
            className="w-40"
          />
          {dated ? null : (
            <p className="text-label text-critical-text">Enter a date like {today()}</p>
          )}
        </div>
      </div>
      {grams > 0 && planContext ? (
        <p className="text-label text-ink-muted tabular-nums" aria-live="polite">
          Then {formatGrams(after)} green ·{' '}
          {planLine(
            beanPlan({ ...bean, greenG: after }, planContext).batchesG,
            planContext.roaster.batchMinG,
          )}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
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
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() => {
            run(
              'beans.adjust-stock-failed',
              async () => {
                const adjusted = await api.adjustStock({ beanId: bean.id, greenG, roastedG });
                if (adjusted.ok) onDone();
                else setProblem(FAILED);
              },
              { failed: "Couldn't save the stock · try again" },
            );
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}

/**
 * Green beans out of stock for any reason but a roast: given away, spilled, a sample. Kept in the
 * bean's stock history with your words (docs/spec/batch-and-stock.md, Stock history).
 */
export function TakeOutStockForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  const { api } = useDeps();
  const run = useRun();
  const [weight, setWeight] = useState('');
  const [why, setWhy] = useState('');
  const [problem, setProblem] = useState<string>();
  const grams = Number(weight);
  const tooMuch = grams > bean.greenG;
  const valid = grams > 0 && !tooMuch;
  return (
    <section aria-label="Take out stock" className="flex flex-col gap-3">
      <h3 className="text-heading">Take out stock</h3>
      <div className="flex flex-wrap items-start gap-3">
        <NumberField
          label="Weight"
          unit="g"
          value={weight}
          onChange={setWeight}
          invalid={tooMuch}
          hint={tooMuch ? `Only ${formatGrams(bean.greenG)} green left` : undefined}
          className="w-40"
        />
        <TextField
          label="Why"
          value={why}
          onChange={setWhy}
          placeholder="Gave some to a friend"
          maxLength={120}
          className="w-72"
        />
      </div>
      {valid ? (
        <p className="text-label text-ink-muted tabular-nums" aria-live="polite">
          Then {formatGrams(bean.greenG - grams)} green
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() => {
            run(
              'beans.take-out-stock-failed',
              async () => {
                const taken = await api.adjustStock({
                  beanId: bean.id,
                  greenG: bean.greenG - grams,
                  roastedG: bean.roastedG,
                  reason: 'taken',
                  note: why.trim() === '' ? null : why.trim(),
                });
                if (taken.ok) onDone();
                else setProblem(FAILED);
              },
              { failed: "Couldn't take out the stock · try again" },
            );
          }}
        >
          {grams > 0 ? `Take out ${formatGrams(grams)}` : 'Take out'}
        </Button>
      </div>
    </section>
  );
}
