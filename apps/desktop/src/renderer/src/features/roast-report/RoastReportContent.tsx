import type { RoastReport } from '@roastpilot/core';
import { CompareTable, PhaseSplit } from '@roastpilot/ui';
import { Info } from 'lucide-react';
import { useTemperatureUnit } from '../use-temperature-unit';
import { phaseNote, phaseParts, planRows } from './report-text';
import { ReportFindings, type FindingPointer } from './ReportFindings';

/**
 * What a finished roast's report says (docs/spec/roast-report.md): its phase split, what is worth
 * a look and notes on how it went, and an Auto roast against its plan. `compact` leaves the plan
 * out, where the report shares a card with the roast's result.
 */
export function RoastReportContent({
  report,
  compact = false,
  pointer,
}: {
  report: RoastReport;
  compact?: boolean;
  /** Where the roast's chart is beside the report (History): findings point out their time on it. */
  pointer?: FindingPointer | undefined;
}) {
  const unit = useTemperatureUnit();
  const note = phaseNote(report);
  return (
    <div className="flex flex-col gap-4">
      {report.phases.length > 0 ? (
        <div className="flex flex-col gap-2">
          <PhaseSplit parts={phaseParts(report, unit)} />
          {note ? <p className="text-label text-ink-muted">{note}</p> : null}
        </div>
      ) : null}
      {report.findings.length > 0 ? (
        <ReportFindings report={report} unit={unit} pointer={pointer} />
      ) : (
        <p className="flex items-center gap-2.5 text-body text-ink-muted">
          <Info aria-hidden="true" className="size-5 shrink-0" />
          Nothing stood out: no crash, flick or stall, and development in a usual range
        </p>
      )}
      {report.plan && !compact ? (
        // Kept narrow, so each row's numbers sit close to its name on a wide window.
        <div className="flex max-w-2xl flex-col gap-1">
          <h3 className="text-label font-medium text-ink-muted">Against the plan</h3>
          <CompareTable
            label="Against the plan"
            otherTitle="Plan"
            rows={planRows(report.plan, unit)}
            className="bg-transparent p-0"
          />
        </div>
      ) : null}
    </div>
  );
}
