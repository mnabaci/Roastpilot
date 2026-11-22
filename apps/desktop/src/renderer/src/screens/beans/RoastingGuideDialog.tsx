import { isBeansRow, ROAST_GUIDE, type NotedField, type NotedValues } from '@roastpilot/core';
import { Badge, cn, Dialog, NavList } from '@roastpilot/ui';
import { useState } from 'react';

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The Roasting cheat sheet (docs/spec/beans-favourites-ghost.md, Roast notes): every value's note,
 * a section at a time, as Settings: the sections on the left, each with the bean's own value
 * under it, and the open one's values as cards on the right, the bean's own marked "This bean".
 * The same words as the ⓘ beside each field.
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
  const [picked, setPicked] = useState<NotedField>();
  const shown = picked ?? start ?? 'process';
  const section = ROAST_GUIDE.find((s) => s.field === shown) ?? ROAST_GUIDE[0];
  /** The bean's row in a section ("High grown"), if it has one there. */
  const beansRow = (field: NotedField) =>
    values
      ? ROAST_GUIDE.find((s) => s.field === field)?.rows.find((row) =>
          isBeansRow(field, values[field], row),
        )
      : undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setPicked(undefined);
        }
      }}
      title="Roasting cheat sheet"
      description="What a bean's values often mean for roasting · starting points, not rules"
      // As tall whichever section is open, so the dialog never jumps as you switch.
      className="h-140 max-w-200"
    >
      <div className="grid min-h-0 flex-1 grid-cols-[11rem_1fr] gap-6">
        <NavList
          label="Sections"
          className="min-h-0 overflow-y-auto"
          items={ROAST_GUIDE.map((s) => {
            const own = beansRow(s.field);
            return { id: s.field, label: s.title, ...(own ? { detail: own.name } : {}) };
          })}
          openId={shown}
          onOpen={setPicked}
        />
        {section ? (
          <section
            aria-labelledby="guide-section"
            className="-mr-2 flex min-h-0 flex-col gap-3 overflow-y-auto pr-2"
          >
            <h3 id="guide-section" className="text-body font-semibold text-ink">
              {section.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {section.rows.map((row) => {
                const own = beansRow(section.field) === row;
                return (
                  <li
                    key={row.name}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border px-4 py-3',
                      own ? 'border-border-strong bg-surface-hover' : 'border-border',
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-body font-semibold text-ink">{row.name}</span>
                      {row.range ? (
                        <span className="text-label text-ink-muted tabular-nums">{row.range}</span>
                      ) : null}
                      {own ? <Badge className="ml-auto self-center">This bean</Badge> : null}
                    </div>
                    <p className="text-label text-ink-muted">{capital(row.what)}.</p>
                    {row.how.map((line) => (
                      <p key={line} className="text-label text-ink">
                        {line}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
