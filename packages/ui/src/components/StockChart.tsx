import { useState, type PointerEvent } from 'react';
import { cn } from '../lib/utils';

export interface StockPoint {
  /** When the stock moved. */
  atMs: number;
  /** The stock after it, in grams. */
  valueG: number;
  /** The date as shown: "4 Nov". */
  date: string;
  /** What moved it: "Roasted · −400 g". */
  what: string;
}

export interface StockChartProps {
  /** The plot's one-line summary, for screen readers. */
  label: string;
  /** Oldest first. */
  points: readonly StockPoint[];
  /** The bean's low-stock line; 0 or none leaves it out. */
  lowG?: number | undefined;
  /** Where the last step runs to. */
  nowMs: number;
  /** "1,200 g". */
  formatGrams: (g: number) => string;
  className?: string;
}

/** 0–100 across the plot. */
const share = (value: number, from: number, to: number) =>
  to === from ? 0 : ((value - from) / (to - from)) * 100;

/**
 * A bean's green stock over time, as steps (design system: StockChart). Props in only: the screen
 * works out the points.
 */
export function StockChart({
  label,
  points,
  lowG,
  nowMs,
  formatGrams,
  className,
}: StockChartProps) {
  const [hover, setHover] = useState<number>();
  const first = points[0];
  if (!first) return null;
  const startMs = first.atMs;
  const endMs = Math.max(nowMs, points.at(-1)?.atMs ?? startMs);
  const low = lowG !== undefined && lowG > 0 ? lowG : undefined;
  // Headroom above the highest step, so the line never runs along the top.
  const topG = Math.max(...points.map((p) => p.valueG), low ?? 0, 1) * 1.15;
  const x = (ms: number) => share(ms, startMs, endMs);
  // SVG y runs down: 100 is the baseline.
  const y = (g: number) => 100 - share(g, 0, topG);
  // Flat to the next movement, then straight up or down to its stock: stock moves only at events.
  const line = points
    .map((p, i) => {
      const toX = String(x(points[i + 1]?.atMs ?? endMs));
      const atY = String(y(p.valueG));
      return i === 0 ? `M${String(x(p.atMs))} ${atY} H${toX}` : `V${atY} H${toX}`;
    })
    .join(' ');
  const area = `${line} V100 H${String(x(startMs))} Z`;

  // The step under the pointer: the last movement at or before it.
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const atMs = startMs + ((event.clientX - box.left) / box.width) * (endMs - startMs);
    let index = 0;
    points.forEach((p, i) => {
      if (p.atMs <= atMs) index = i;
    });
    setHover(index);
  };
  const shown = hover === undefined ? undefined : points[hover];
  const shownX = shown ? x(shown.atMs) : 0;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex gap-2">
        {/* The scale: the top value and 0, beside the plot. */}
        <div
          aria-hidden="true"
          className="flex w-14 shrink-0 flex-col justify-between text-right text-label text-ink-muted tabular-nums"
        >
          <span className="-mt-2">{formatGrams(topG / 1.15)}</span>
          <span className="-mb-2">0</span>
        </div>
        <div
          role="img"
          aria-label={label}
          className="relative h-40 min-w-0 flex-1"
          onPointerMove={onMove}
          onPointerLeave={() => {
            setHover(undefined);
          }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
          >
            <line
              x1="0"
              x2="100"
              y1={y(topG / 1.15)}
              y2={y(topG / 1.15)}
              vectorEffect="non-scaling-stroke"
              className="stroke-chart-grid"
            />
            <line
              x1="0"
              x2="100"
              y1="100"
              y2="100"
              vectorEffect="non-scaling-stroke"
              className="stroke-chart-grid"
            />
            <path d={area} className="fill-air-tint" />
            {low === undefined ? null : (
              <line
                x1="0"
                x2="100"
                y1={y(low)}
                y2={y(low)}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className="stroke-heat"
              />
            )}
            <path
              d={line}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-air"
            />
          </svg>
          {low === undefined ? null : (
            <span
              aria-hidden="true"
              // Data, not layout: it sits on the low-stock line.
              style={{ top: `${String(y(low))}%` }}
              className="absolute right-0 -translate-y-full pb-0.5 text-label text-ink-muted tabular-nums"
            >
              Low {formatGrams(low)}
            </span>
          )}
          {shown ? (
            <>
              <span
                aria-hidden="true"
                style={{ left: `${String(shownX)}%` }}
                className="pointer-events-none absolute inset-y-0 w-px bg-border-strong"
              />
              <span
                aria-hidden="true"
                style={{ left: `${String(shownX)}%`, top: `${String(y(shown.valueG))}%` }}
                className="pointer-events-none absolute size-2 -translate-1/2 rounded-full bg-air ring-2 ring-surface"
              />
              <div
                aria-hidden="true"
                style={{ left: `${String(shownX)}%` }}
                className={cn(
                  'pointer-events-none absolute top-0 flex w-max flex-col gap-0.5 rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-label tabular-nums',
                  // Past the middle it opens to the left, so it never runs off the card.
                  shownX > 50 ? '-translate-x-full -ml-2' : 'ml-2',
                )}
              >
                <span className="text-ink-muted">{shown.date}</span>
                <span className="text-ink">{shown.what}</span>
                <span className="text-ink">{formatGrams(shown.valueG)} green</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex justify-between pl-16 text-label text-ink-muted tabular-nums"
      >
        <span>{first.date}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
