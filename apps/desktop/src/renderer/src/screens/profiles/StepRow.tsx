import { Button, NumberField } from '@roastpilot/ui';
import { X } from 'lucide-react';
import type { DraftErrors, StepDraft } from './profile-draft';
import { CELL, FIXED } from './step-cells';

const ROR_CELLS = [
  { key: 'rorMin', label: 'RoR min' },
  { key: 'rorMax', label: 'RoR max' },
] as const;

/** One step's cells, then its problems on their own line. The last step ends the roast. */
export function StepRow({
  step,
  index,
  last,
  errors,
  steps,
  columns,
  readOnly,
  onChange,
  onRemove,
}: {
  step: StepDraft;
  index: number;
  last: boolean;
  errors: DraftErrors;
  steps: boolean;
  columns: number;
  readOnly: boolean;
  onChange: (change: Partial<StepDraft>) => void;
  onRemove: () => void;
}) {
  const error = (cell: string) => errors[`steps.${String(index)}.${cell}`];
  const name = step.name || `Step ${String(index + 1)}`;
  const field = (cell: keyof StepDraft, label: string) => (
    <NumberField
      label={`${name} ${label}`}
      hideLabel
      // Times ("11:00") need more room than a two-digit percentage, even in a narrow window.
      {...(cell === 'time' || cell === 'backup' ? { className: 'min-w-18' } : {})}
      value={step[cell]}
      disabled={readOnly}
      invalid={Boolean(error(cell))}
      onChange={(value) => {
        onChange({ [cell]: value });
      }}
    />
  );
  const problems = [
    ...new Set(
      (Object.keys(step) as (keyof StepDraft)[]).flatMap((cell) => {
        const message = error(cell);
        return message ? [message] : [];
      }),
    ),
  ];
  return (
    <>
      <tr>
        <td className={CELL}>
          <input
            aria-label={`Step ${String(index + 1)} name`}
            aria-invalid={Boolean(error('name')) || undefined}
            value={step.name}
            disabled={readOnly}
            onChange={(event) => {
              onChange({ name: event.target.value });
            }}
            className="h-control-sm w-full min-w-30 rounded-md border border-border bg-surface px-2.5 text-body text-ink hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
          />
        </td>
        {steps || !last ? (
          <td className={CELL}>{field('endC', 'end temperature')}</td>
        ) : (
          <td className={FIXED}>
            <span>–</span>
          </td>
        )}
        {steps ? <td className={CELL}>{field('time', 'time')}</td> : null}
        {steps
          ? ROR_CELLS.map(({ key, label }) => (
              <td key={key} className={CELL}>
                {field(key, label)}
              </td>
            ))
          : null}
        <td className={CELL}>{field('heat', 'heat')}</td>
        <td className={CELL}>{field('fan', 'fan')}</td>
        <td className={CELL}>{last ? null : field('backup', 'backup time')}</td>
        <td className={CELL}>
          {last || readOnly ? null : (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${name}`}
              icon={<X aria-hidden="true" />}
              onClick={onRemove}
            />
          )}
        </td>
      </tr>
      {problems.length > 0 ? (
        <tr>
          <td colSpan={columns} className="px-1 pb-1">
            <p role="alert" className="text-label text-critical-text">
              {name}: {problems.join(' · ')}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
