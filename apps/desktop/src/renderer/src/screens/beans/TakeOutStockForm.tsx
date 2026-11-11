import type { Bean } from '@roastpilot/shared';
import { Button, NumberField, TextField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { formatGrams } from './batch-format';
import { isStockDate, today } from './stock-date';
import { adjustedOn, FAILED } from './stock-change';
import { StockDateField, StockFormFooter, ThenLine } from './stock-form-parts';

/** Green beans that leave the bag for any reason but a roast, never more than there is. */
export function TakeOutStockForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  const { api } = useDeps();
  const run = useRun();
  const [weight, setWeight] = useState('');
  const [day, setDay] = useState(() => today());
  const [why, setWhy] = useState('');
  const [problem, setProblem] = useState<string>();
  const grams = Number(weight);
  const tooMuch = grams > bean.greenG;
  const valid = grams > 0 && !tooMuch && isStockDate(day);
  return (
    <div className="flex flex-col gap-3">
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
        <StockDateField label="Taken out on" value={day} onChange={setDay} />
      </div>
      <TextField
        label="Why"
        value={why}
        onChange={setWhy}
        placeholder="Gave some to a friend"
        maxLength={120}
      />
      {grams > 0 && !tooMuch ? <ThenLine bean={bean} greenG={bean.greenG - grams} /> : null}
      <StockFormFooter problem={problem} onCancel={onDone}>
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
                  reason: 'taken',
                  note: why.trim() === '' ? null : why.trim(),
                  adjustedOn: adjustedOn(day),
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
      </StockFormFooter>
    </div>
  );
}
