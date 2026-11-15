import { cn } from '../lib/utils';

export interface PhaseSplitPart {
  key: string;
  label: string;
  /** Under the label, e.g. `4:24 · 40 %`. */
  detail: string;
  /** Said instead of `detail` by screen readers, where its symbols don't read well (≈). */
  spokenDetail?: string;
  /** Where it ended, a third quiet line: the BT at its end, e.g. `to 150 °C`. */
  end?: string | undefined;
  /** Its part of the whole, 0–1: how wide its segment is. */
  share: number;
  /** How strong its fill: stronger further into the roast, as the chart's phase bands. */
  tone: 'low' | 'mid' | 'high';
}

const TONE: Record<PhaseSplitPart['tone'], string> = {
  low: 'bg-target/30',
  mid: 'bg-target/60',
  high: 'bg-target',
};

/**
 * Each column as wide as its segment, so a phase's numbers sit under it; never so narrow its
 * name won't fit (a short development), the others giving way.
 */
const column = (share: number) => ({ flexGrow: share, flexBasis: 0, minWidth: '5.5rem' });

/**
 * A roast split into its phases (design system: PhaseSplit): one bar, each phase as wide as its
 * share, with each phase's length, share and where it ended under its segment. Neutral fills only:
 * a longer phase isn't better or worse.
 */
export function PhaseSplit({
  parts,
  label = 'Phases',
  className,
}: {
  parts: readonly PhaseSplitPart[];
  /** Names the group for screen readers. */
  label?: string;
  className?: string;
}) {
  if (parts.length === 0) return null;
  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-2.5', className)}>
      <div aria-hidden="true" className="flex h-2.5 gap-0.5">
        {parts.map((part) => (
          <div
            key={part.key}
            className={cn('first:rounded-l-full last:rounded-r-full', TONE[part.tone])}
            style={column(part.share)}
          />
        ))}
      </div>
      <dl className="flex gap-0.5">
        {parts.map((part) => (
          <div
            key={part.key}
            className="flex min-w-0 flex-col gap-0.5 pr-3"
            style={column(part.share)}
          >
            <dt className="flex min-w-0 items-center gap-1.5 text-label text-ink-muted">
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', TONE[part.tone])}
              />
              <span className="truncate">{part.label}</span>
            </dt>
            <dd className="m-0 truncate text-body text-ink tabular-nums">
              <span aria-hidden={part.spokenDetail ? true : undefined}>{part.detail}</span>
              {part.spokenDetail ? <span className="sr-only">{part.spokenDetail}</span> : null}
            </dd>
            {part.end ? (
              <dd className="m-0 truncate text-label text-ink-muted tabular-nums">{part.end}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
