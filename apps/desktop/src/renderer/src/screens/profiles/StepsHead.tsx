import { rorSymbol, tempSymbol, type TemperatureUnit } from '@roastpilot/shared';
import { cn } from '@roastpilot/ui';

// Headers stay on one line at 960 px: RoR's unit sits once over its min and max (a group).
const HEAD =
  'px-0.5 pb-1 text-left align-bottom text-label font-normal whitespace-nowrap text-ink-muted xl:px-1';

/** The steps table's headers; a step profile adds Time and RoR min and max under one header. */
export function StepsHead({
  unit,
  steps,
  readOnly,
}: {
  unit: TemperatureUnit;
  steps: boolean;
  readOnly: boolean;
}) {
  const span = steps ? 2 : 1;
  return (
    <thead>
      <tr>
        {readOnly ? null : <th rowSpan={span} aria-label="Move" />}
        <th rowSpan={span} className={HEAD}>
          Step
        </th>
        <th rowSpan={span} className={HEAD}>
          Ends {tempSymbol(unit)}
        </th>
        {steps ? (
          <th rowSpan={2} className={HEAD}>
            Time
          </th>
        ) : null}
        {steps ? (
          <th colSpan={2} scope="colgroup" className={cn(HEAD, 'pb-0')}>
            RoR {rorSymbol(unit)}
          </th>
        ) : null}
        <th rowSpan={span} className={HEAD}>
          Heat %
        </th>
        <th rowSpan={span} className={HEAD}>
          Fan %
        </th>
        <th rowSpan={span} className={HEAD}>
          Backup
        </th>
        <th rowSpan={span} aria-label="Remove" />
      </tr>
      {steps ? (
        <tr>
          <th scope="col" className={HEAD}>
            Min
          </th>
          <th scope="col" className={HEAD}>
            Max
          </th>
        </tr>
      ) : null}
    </thead>
  );
}
