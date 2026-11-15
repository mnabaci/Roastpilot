import { needsAttention, type RoastReport } from '@roastpilot/core';
import type { TemperatureUnit } from '@roastpilot/shared';
import { cn } from '@roastpilot/ui';
import { ChartSpline, CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { findingSpan, findingText } from './report-text';

/** Points a finding out on the roast's chart: hovering or focusing previews it, a click keeps it. */
export interface FindingPointer {
  /** The finding kept on the chart, by its place in the list. */
  pinned: number | undefined;
  onPreview: (index: number | undefined) => void;
  onPin: (index: number | undefined) => void;
}

/**
 * A report's findings: what is worth a look (a warning icon) then notes (a quiet one), each a title
 * and a line of numbers. With a `pointer`, each one with a time is a button that shows it on the chart.
 */
export function ReportFindings({
  report,
  unit,
  pointer,
}: {
  report: RoastReport;
  unit: TemperatureUnit;
  pointer?: FindingPointer | undefined;
}) {
  return (
    <ul aria-label="Findings" className="-mx-2 flex flex-col gap-0.5">
      {report.findings.map((finding, i) => {
        const attention = needsAttention(finding);
        const text = findingText(finding, unit);
        const Icon = attention ? CircleAlert : Info;
        const content: ReactNode = (
          <>
            <Icon
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-5 shrink-0',
                attention ? 'text-warning' : 'text-ink-muted',
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body text-ink">
                {attention ? <span className="sr-only">Worth a look: </span> : null}
                {text.title}
              </span>
              <span className="text-label text-ink-muted tabular-nums">{text.detail}</span>
            </span>
          </>
        );
        const row = 'flex w-full gap-2.5 rounded-lg px-2 py-1.5 text-left';
        const span = pointer ? findingSpan(finding, report) : undefined;
        return (
          <li key={`${finding.kind}-${String(i)}`}>
            {pointer && span ? (
              <button
                type="button"
                aria-pressed={pointer.pinned === i}
                onClick={() => {
                  pointer.onPin(pointer.pinned === i ? undefined : i);
                }}
                onPointerEnter={() => {
                  pointer.onPreview(i);
                }}
                onPointerLeave={() => {
                  pointer.onPreview(undefined);
                }}
                onFocus={() => {
                  pointer.onPreview(i);
                }}
                onBlur={() => {
                  pointer.onPreview(undefined);
                }}
                className={cn(
                  row,
                  'group hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus',
                  pointer.pinned === i && 'bg-surface-hover',
                )}
              >
                {content}
                <span className="sr-only">Show on the chart</span>
                <ChartSpline
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 size-4 shrink-0 text-ink-muted transition-opacity',
                    pointer.pinned === i
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                  )}
                />
              </button>
            ) : (
              <div className={row}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
