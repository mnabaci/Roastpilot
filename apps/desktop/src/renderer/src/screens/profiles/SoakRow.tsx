import { cn, formatClock, NumberField, SelectField } from '@roastpilot/ui';
import type { DraftErrors, ProfileDraft } from './profile-draft';
import { CELL, FIXED } from './step-cells';
import { soakFromValue, soakOptions, soakValue } from './soak-lengths';

/**
 * The Soak row: its length (Off leaves it out, the row stays so it can come back) and its fan. A
 * step profile has its length under Time; a curve profile, which has no Time, under Backup.
 */
export function SoakRow({
  draft,
  errors,
  steps,
  columns,
  readOnly,
  onChange,
}: {
  draft: ProfileDraft;
  errors: DraftErrors;
  steps: boolean;
  columns: number;
  readOnly: boolean;
  onChange: (next: ProfileDraft) => void;
}) {
  const off = draft.soakS === null;
  const length = readOnly ? (
    <td className={FIXED}>
      <span>{draft.soakS === null ? 'Off' : formatClock(draft.soakS)}</span>
    </td>
  ) : (
    <td className={CELL}>
      <SelectField
        label="Soak length"
        hideLabel
        numeric
        className="min-w-20"
        value={soakValue(draft.soakS)}
        options={soakOptions(draft.soakS)}
        onChange={(value) => {
          onChange({ ...draft, soakS: soakFromValue(value) });
        }}
      />
    </td>
  );
  return (
    <>
      <tr>
        <td className={cn(FIXED, 'text-ink')}>
          <span>Soak</span>
        </td>
        <td className={FIXED}>
          <span>–</span>
        </td>
        {steps ? length : null}
        {steps ? <td className={CELL} /> : null}
        {steps ? <td className={CELL} /> : null}
        <td className={FIXED}>
          <span>{off ? '–' : '0'}</span>
        </td>
        <td className={CELL}>
          <NumberField
            label="Soak fan"
            hideLabel
            value={draft.soakFan}
            disabled={readOnly || off}
            invalid={Boolean(errors.soakFan)}
            onChange={(soakFan) => {
              onChange({ ...draft, soakFan });
            }}
          />
        </td>
        {steps ? <td className={CELL} /> : length}
        <td className={CELL} />
      </tr>
      {errors.soakFan ? (
        <tr>
          <td colSpan={columns} className="px-1 pb-1">
            <p role="alert" className="text-label text-critical-text">
              Soak: {errors.soakFan}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
