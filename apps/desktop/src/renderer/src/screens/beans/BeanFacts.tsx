import { beanHints } from '@roastpilot/core';
import type { Bean } from '@roastpilot/shared';
import { cn } from '@roastpilot/ui';
import { Lightbulb } from 'lucide-react';

/** `greencoffeecollective.com` for a link to any page of it. */
function siteOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

interface Fact {
  label: string;
  value: string | null;
  /** A second, quieter line under the value. */
  under?: string | undefined;
  /** Notes run the card's full width. */
  wide?: boolean;
  /** A web address keeps its case; other values start with a capital. */
  asWritten?: boolean;
}

const facts = (bean: Bean): readonly Fact[] => [
  { label: 'Origin', value: bean.origin },
  { label: 'Process', value: bean.process },
  { label: 'Variety', value: bean.variety },
  { label: 'Altitude', value: bean.altitudeM === null ? null : `${String(bean.altitudeM)} m` },
  { label: 'Density', value: bean.densityGL === null ? null : `${String(bean.densityGL)} g/L` },
  {
    label: 'Moisture',
    value: bean.moisturePct === null ? null : `${String(bean.moisturePct)} %`,
  },
  { label: 'Bean size', value: bean.screen === null ? null : `Screen ${String(bean.screen)}` },
  { label: 'Decaf', value: bean.decaf ? 'Yes' : null },
  // The shop and, under it, where Order again goes: its site, short and as written.
  {
    label: 'Supplier',
    value: bean.supplier ?? (bean.link === null ? null : siteOf(bean.link)),
    under: bean.supplier !== null && bean.link !== null ? siteOf(bean.link) : undefined,
    asWritten: bean.supplier === null,
  },
  { label: 'Notes', value: bean.notes, wide: true },
];

/**
 * What the record says, as tiles in a card, with the bean's hints at its foot (docs/spec/ui.md,
 * Beans screen). An empty field isn't shown.
 */
export function BeanFacts({ bean }: { bean: Bean }) {
  const hints = beanHints(bean);
  return (
    <section
      aria-label="About this bean"
      className="@container flex flex-col gap-4 rounded-xl bg-surface p-5"
    >
      {/* As many columns as the card's width holds well: 3 beside a narrow window, up to 6. */}
      <dl className="grid grid-cols-3 gap-4 @3xl:grid-cols-4 @5xl:grid-cols-6">
        {facts(bean).flatMap(({ label, value, under, wide, asWritten }) =>
          value === null
            ? []
            : [
                <div key={label} className={wide ? 'col-span-full' : 'min-w-0'}>
                  <dt className="text-label text-ink-muted">{label}</dt>
                  <dd
                    className={cn(
                      'mt-0.5 text-body text-ink',
                      !asWritten && 'first-letter:uppercase',
                    )}
                  >
                    {value}
                  </dd>
                  {under ? <dd className="truncate text-label text-ink-muted">{under}</dd> : null}
                </div>,
              ],
        )}
      </dl>
      {hints.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-border pt-4">
          {hints.map((hint) => (
            <li key={hint} className="flex items-start gap-2 text-label text-ink-muted">
              <Lightbulb aria-hidden="true" className="mt-px size-4 shrink-0" />
              {hint}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
