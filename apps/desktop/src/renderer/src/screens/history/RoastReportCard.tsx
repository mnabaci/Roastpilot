import type { RoastReport } from '@roastpilot/core';
import { CollapsibleCard } from '@roastpilot/ui';
import type { FindingPointer } from '../../features/roast-report/ReportFindings';
import { RoastReportContent } from '../../features/roast-report/RoastReportContent';
import { reportSummary } from '../../features/roast-report/report-text';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';

/**
 * The open roast's report in a card that folds to a line (docs/spec/roast-report.md); its findings
 * point out their time on the roast's chart. Open or folded is a setting, the same for every roast.
 */
export function RoastReportCard({
  report,
  pointer,
}: {
  report: RoastReport;
  pointer?: FindingPointer | undefined;
}) {
  const unit = useTemperatureUnit();
  const open = useSettings((s) => s.settings.historyReportOpen);
  const saveSettings = useSaveSettings();
  return (
    <CollapsibleCard
      title="Roast report"
      summary={reportSummary(report, unit)}
      open={open}
      onOpenChange={(next) => {
        saveSettings({ historyReportOpen: next });
      }}
    >
      <RoastReportContent report={report} pointer={pointer} />
    </CollapsibleCard>
  );
}
