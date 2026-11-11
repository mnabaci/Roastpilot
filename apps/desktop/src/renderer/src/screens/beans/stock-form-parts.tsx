import type { Bean } from '@roastpilot/shared';
import { Button, TextField } from '@roastpilot/ui';
import type { ReactNode } from 'react';
import { formatGrams, planLine } from './batch-format';
import { beanPlan } from './bean-plan';
import { isStockDate, today } from './stock-date';
import { usePlanContext } from './use-plan-context';

/** The day a stock change happened: today unless you change it, never after today. */
export function StockDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = isStockDate(value);
  return (
    <div className="flex flex-col gap-1">
      <TextField
        label={label}
        value={value}
        onChange={onChange}
        aria-invalid={!valid || undefined}
        className="w-40"
      />
      {valid ? null : (
        <p className="text-label text-critical-text">Enter a day like {today()}, not after today</p>
      )}
    </div>
  );
}

/**
 * What a change leaves: "Then 1,384 g green · 4 batches · 4 × 346 g", as on the Green card; `lead`
 * replaces "Then … green" (Recount says what it changes instead).
 */
export function ThenLine({ bean, greenG, lead }: { bean: Bean; greenG: number; lead?: string }) {
  const planContext = usePlanContext();
  const plan = planContext
    ? planLine(beanPlan({ ...bean, greenG }, planContext).batchesG, planContext.roaster.batchMinG)
    : undefined;
  const parts = [lead ?? `Then ${formatGrams(greenG)} green`, plan].filter(Boolean);
  return (
    <p className="text-label text-ink-muted tabular-nums" aria-live="polite">
      {parts.join(' · ')}
    </p>
  );
}

/** A save that failed, then Cancel and the change's primary at the right end. */
export function StockFormFooter({
  problem,
  onCancel,
  children,
}: {
  problem: string | undefined;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {children}
      </div>
    </>
  );
}
