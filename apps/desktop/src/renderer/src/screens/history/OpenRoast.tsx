import { roastReport } from '@roastpilot/core';
import type { Bean } from '@roastpilot/shared';
import { CompareTable, EventTable } from '@roastpilot/ui';
import { useMemo, useRef } from 'react';
import { useFindingPointer } from '../../features/roast-report/use-finding-pointer';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import { compareRows } from './compare-rows';
import { eventRows } from './event-rows';
import { RoastDetailsCard } from './RoastDetailsCard';
import { RoastReportCard } from './RoastReportCard';
import { SavedRoastChart } from './SavedRoastChart';
import { SavedRoastStats } from './SavedRoastStats';
import type { SavedRoastState } from './use-saved-roast';

/**
 * The open roast's numbers, details, report, chart, comparison (while comparing) and events, or why there
 * is none to show.
 */
export function OpenRoast({
  selected,
  compared,
  compareLabel,
  live,
  beans,
  smoothingS,
  showPreheat,
  onShowPreheat,
  emptyText,
}: {
  /** Why nothing shows, when it isn't the filters ("No roasts on Simulator yet"). */
  emptyText?: string | undefined;
  selected: SavedRoastState;
  compared: SavedRoastState;
  compareLabel: string;
  /** Being roasted right now: its bean stays as the roast set it. */
  live: boolean;
  beans: readonly Bean[];
  smoothingS: number;
  /** Kept by History while you browse it, so each roast opens the same way. */
  showPreheat: boolean;
  onShowPreheat: (show: boolean) => void;
}) {
  const unit = useTemperatureUnit();
  const detail = selected.status === 'loaded' ? selected.detail : undefined;
  // Undefined until the roast has dropped or stopped with enough readings to say anything.
  const report = useMemo(() => (detail ? roastReport(detail) : undefined), [detail]);
  const chartRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // A finding clicked in the report brings the chart into view with its time picked out.
  const { pointer, span } = useFindingPointer(detail?.id, report, () => {
    chartRef.current?.scrollIntoView({
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  });
  switch (selected.status) {
    case 'none':
      return (
        <p className="text-body text-ink-muted">{emptyText ?? 'No roasts match these filters'}</p>
      );
    case 'loading':
      return <p className="text-label text-ink-muted">Loading…</p>;
    case 'failed':
      return (
        <p role="alert" className="text-body text-critical-text">
          Couldn't open this roast · see Logs
        </p>
      );
    case 'loaded': {
      const { detail } = selected;
      return (
        <>
          <SavedRoastStats roast={detail} />
          <RoastDetailsCard roast={detail} report={report} beans={beans} live={live} />
          {report ? <RoastReportCard report={report} pointer={pointer} /> : null}
          <div ref={chartRef} className="scroll-my-4">
            <SavedRoastChart
              detail={detail}
              span={span}
              compare={compared.status === 'loaded' ? compared.detail : undefined}
              compareLabel={compareLabel}
              smoothingS={smoothingS}
              showPreheat={showPreheat}
              onShowPreheat={onShowPreheat}
            />
          </div>
          {compared.status === 'loaded' ? (
            <CompareTable
              otherTitle={compareLabel}
              rows={compareRows(detail, compared.detail, unit, beans)}
            />
          ) : null}
          <EventTable rows={eventRows(detail, unit)} />
        </>
      );
    }
  }
}
