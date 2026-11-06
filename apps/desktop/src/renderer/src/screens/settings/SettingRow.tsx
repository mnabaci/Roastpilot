import type { ReactNode } from 'react';

/** One setting: its name and a one-line hint on the left, its control on the right. */
export function SettingRow({
  name,
  hint,
  children,
}: {
  name: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border py-4 first:border-t-0">
      <div className="flex min-w-60 flex-1 flex-col gap-0.5">
        <h3 className="text-body font-semibold">{name}</h3>
        <p className="text-label text-ink-muted">{hint}</p>
      </div>
      <div className="flex flex-col items-end gap-2">{children}</div>
    </div>
  );
}

/** A section's rows in one card. */
export function SettingCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex max-w-3xl flex-col gap-3">
      <h2 className="text-heading">{title}</h2>
      <div className="flex flex-col rounded-xl bg-surface px-5">{children}</div>
    </section>
  );
}
