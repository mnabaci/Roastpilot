import { Button, cn, NumberField } from '@roastpilot/ui';
import { X } from 'lucide-react';
import { stepName, type DraftErrors, type StepDraft } from './profile-draft';
import { BUTTON_CELL, CELL, FIELD_MIN, FIELD_MIN_DEFAULT, FIXED } from './step-cells';
import { StepHandle } from './StepHandle';
import type { StepMoves } from './use-step-moves';

const ROR_CELLS = [
  { key: 'rorMin', label: 'RoR min' },
  { key: 'rorMax', label: 'RoR max' },
] as const;

/**
 * One step's cells, then its problems on their own line. The last step ends the roast, so it has
 * no handle; `moves` is left out where nothing can be moved (a built-in).
 */
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
  moves,
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
  moves?: StepMoves | undefined;
}) {
  const error = (cell: string) => errors[`steps.${String(index)}.${cell}`];
  const name = stepName(step, index);
  const field = (cell: keyof StepDraft, label: string) => (
    <NumberField
      label={`${name} ${label}`}
      hideLabel
      className={FIELD_MIN[cell] ?? FIELD_MIN_DEFAULT}
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
      <tr {...moves?.row(index)} className={cn(moves?.dragging === index && 'opacity-50')}>
        {moves ? (
          <td className={BUTTON_CELL}>
            {last ? null : <StepHandle name={name} index={index} moves={moves} />}
          </td>
        ) : null}
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
        <td className={BUTTON_CELL}>
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
