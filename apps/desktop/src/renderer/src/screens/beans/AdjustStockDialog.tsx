import type { Bean } from '@roastpilot/shared';
import { Dialog, SegmentedControl } from '@roastpilot/ui';
import { useState } from 'react';
import { AddStockForm } from './AddStockForm';
import { formatGrams } from './batch-format';
import { RecountStockForm } from './RecountStockForm';
import { TakeOutStockForm } from './TakeOutStockForm';

type StockChange = 'add' | 'take-out' | 'recount';

const CHANGES = [
  { value: 'add', label: 'Add' },
  { value: 'take-out', label: 'Take out' },
  { value: 'recount', label: 'Recount' },
] as const;

/**
 * Every change to a bean's stock in one dialog (docs/spec/batch-and-stock.md): new stock, green
 * taken out for any reason, or a recount, each kept in the bean's stock history.
 */
export function AdjustStockDialog({
  bean,
  open,
  onClose,
}: {
  bean: Bean;
  open: boolean;
  onClose: () => void;
}) {
  const [change, setChange] = useState<StockChange>('add');
  const close = () => {
    onClose();
    // It opens on Add again next time.
    setChange('add');
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(opened) => {
        if (!opened) close();
      }}
      title="Adjust stock"
      description={`${bean.name} · ${formatGrams(bean.greenG)} green`}
    >
      <SegmentedControl
        label="Change"
        options={CHANGES}
        value={change}
        onChange={setChange}
        className="self-start"
      />
      {change === 'add' ? <AddStockForm bean={bean} onDone={close} /> : null}
      {change === 'take-out' ? <TakeOutStockForm bean={bean} onDone={close} /> : null}
      {change === 'recount' ? <RecountStockForm bean={bean} onDone={close} /> : null}
    </Dialog>
  );
}
