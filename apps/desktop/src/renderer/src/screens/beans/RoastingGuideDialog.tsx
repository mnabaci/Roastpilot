import { isBeansRow, ROAST_GUIDE, type NotedField, type NotedValues } from '@roastpilot/core';
import { Badge, cn, Dialog } from '@roastpilot/ui';
import { useEffect, useRef } from 'react';

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The Roasting cheat sheet (docs/spec/beans-favourites-ghost.md, Roast notes): every value's
 * note on one page, a section per field, the bean's own rows marked "This bean". The same words
 * as the ⓘ beside each field.
 */
export function RoastingGuideDialog({
  open,
  onClose,
  start,
  values,
}: {
  open: boolean;
  onClose: () => void;
  /** The section to open at: the field whose ⓘ led here. */
  start?: NotedField | undefined;
  /** The bean's values, to mark its rows; none from the Beans list with no bean open. */
  values?: NotedValues | undefined;
}) {
  const sections = useRef(new Map<NotedField, HTMLElement>());
  useEffect(() => {
    if (!open || !start) return;
    // After the dialog has laid out: its own scroller brings the section to the top.
    const frame = requestAnimationFrame(() => {
      sections.current.get(start)?.scrollIntoView({ block: 'start' });
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, start]);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Roasting cheat sheet"
      description="What a bean's values often mean for roasting · starting points, not rules"
      className="max-w-180"
    >
      {/* Stays at the top as the sheet scrolls: one click to any section. */}
      <nav
        aria-label="Sections"
        className="sticky -top-5 z-10 -mx-5 -my-2 flex flex-wrap gap-1.5 border-b border-border bg-surface px-5 py-2.5"
      >
        {ROAST_GUIDE.map((section) => (
          <button
            key={section.field}
            type="button"
            onClick={() => {
              sections.current.get(section.field)?.scrollIntoView({ block: 'start' });
            }}
            className="rounded-full bg-surface-hover px-3 py-1 text-label text-ink hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {section.title}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-5">
        {ROAST_GUIDE.map((section) => (
          <section
            key={section.field}
            aria-labelledby={`guide-${section.field}`}
            ref={(element) => {
              if (element) sections.current.set(section.field, element);
            }}
            className="flex scroll-mt-16 flex-col gap-2"
          >
            <h3 id={`guide-${section.field}`} className="text-body font-semibold text-ink">
              {section.title}
            </h3>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {section.rows.map((row) => {
                const own = values ? isBeansRow(section.field, values[section.field], row) : false;
                return (
                  <li
                    key={row.name}
                    className={cn(
                      'grid grid-cols-[7rem_1fr] gap-x-4 px-3.5 py-2.5 first:rounded-t-lg last:rounded-b-lg',
                      own && 'bg-surface-hover',
                    )}
                  >
                    <div className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="text-body font-medium text-ink">{row.name}</span>
                      {row.range ? (
                        <span className="text-label text-ink-muted tabular-nums">{row.range}</span>
                      ) : null}
                      {own ? <Badge className="mt-1">This bean</Badge> : null}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5 text-label">
                      <p className="text-ink-muted">{capital(row.what)}.</p>
                      {row.how.map((line) => (
                        <p key={line} className="text-ink">
                          {line}
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
