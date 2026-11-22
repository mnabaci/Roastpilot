import type { ReactNode } from 'react';

/**
 * Why History shows no roast, and what to do about it (docs/spec/ui.md, History): no roasts yet,
 * none on this roaster, or none matching the filters. One heading, one line, its buttons.
 */
export function HistoryEmpty({
  title,
  detail,
  actions,
}: {
  title: string;
  detail: string;
  actions: ReactNode;
}) {
  return (
    <div role="status" className="flex max-w-md flex-col items-start gap-2 pt-2">
      <h2 className="text-heading text-ink">{title}</h2>
      <p className="text-body text-ink-muted">{detail}</p>
      <div className="mt-2 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
