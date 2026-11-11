import type { Bean } from '@roastpilot/shared';
import { Button, NumberField } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { isStockDate, today } from './stock-date';
import { adjustedOn, FAILED, recountChange } from './stock-change';
import { StockDateField, StockFormFooter, ThenLine } from './stock-form-parts';

/** Green stock as your count says, on the day you counted. */
export function RecountStockForm({ bean, onDone }: { bean: Bean; onDone: () => void }) {
  const { api } = useDeps();
  const run = useRun();
  const [green, setGreen] = useState(String(bean.greenG));
  const [day, setDay] = useState(() => today());
  const [problem, setProblem] = useState<string>();
  const greenG = Number(green);
  const counted = green.trim() !== '' && greenG >= 0;
  const valid = counted && isStockDate(day);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <NumberField label="Green" unit="g" value={green} onChange={setGreen} className="w-40" />
        <StockDateField label="Counted on" value={day} onChange={setDay} />
      </div>
      {counted ? (
        <ThenLine bean={bean} greenG={greenG} lead={recountChange(greenG, bean.greenG)} />
      ) : null}
      <StockFormFooter problem={problem} onCancel={onDone}>
        <Button
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() => {
            run(
              'beans.adjust-stock-failed',
              async () => {
                const adjusted = await api.adjustStock({
                  beanId: bean.id,
                  greenG,
                  adjustedOn: adjustedOn(day),
                });
                if (adjusted.ok) onDone();
                else setProblem(FAILED);
              },
              { failed: "Couldn't save the stock · try again" },
            );
          }}
        >
          Save
        </Button>
      </StockFormFooter>
    </div>
  );
}
