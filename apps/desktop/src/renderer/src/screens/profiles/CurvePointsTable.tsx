import { Button, formatClock, NumberField } from '@roastpilot/ui';
import { X } from 'lucide-react';
import { addPoint, removePoint, type DraftErrors, type ProfileDraft } from './profile-draft';

/** The points a curve profile follows; the first is always charge temp at 0:00. */
export function CurvePointsTable({
  draft,
  errors,
  readOnly,
  onChange,
}: {
  draft: ProfileDraft;
  errors: DraftErrors;
  readOnly: boolean;
  onChange: (next: ProfileDraft) => void;
}) {
  const setPoint = (index: number, change: Partial<ProfileDraft['points'][number]>) => {
    onChange({
      ...draft,
      points: draft.points.map((point, i) => (i === index ? { ...point, ...change } : point)),
    });
  };
  return (
    <section aria-labelledby="curve-heading" className="flex max-w-sm flex-col gap-2">
      <h2 id="curve-heading" className="text-heading">
        Curve points
      </h2>
      <p className="text-body text-ink-muted">
        {formatClock(0)} · {draft.chargeC} °C (charge temp)
      </p>
      {draft.points.map((point, index) => {
        const timeError = errors[`points.${String(index)}.time`];
        const tempError = errors[`points.${String(index)}.c`];
        return (
          <div key={String(index)} className="flex items-start gap-2">
            <NumberField
              label={`Point ${String(index + 1)} time`}
              hideLabel
              className="flex-1"
              value={point.time}
              disabled={readOnly}
              invalid={Boolean(timeError)}
              hint={timeError}
              onChange={(time) => {
                setPoint(index, { time });
              }}
            />
            <NumberField
              label={`Point ${String(index + 1)} temperature`}
              hideLabel
              className="flex-1"
              unit="°C"
              value={point.c}
              disabled={readOnly}
              invalid={Boolean(tempError)}
              hint={tempError}
              onChange={(c) => {
                setPoint(index, { c });
              }}
            />
            {readOnly ? null : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove point ${String(index + 1)}`}
                icon={<X aria-hidden="true" />}
                onClick={() => {
                  onChange(removePoint(draft, index));
                }}
              />
            )}
          </div>
        );
      })}
      {readOnly ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            onChange(addPoint(draft));
          }}
        >
          Add point
        </Button>
      )}
    </section>
  );
}
