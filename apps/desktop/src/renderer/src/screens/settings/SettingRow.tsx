import { cn } from '@roastpilot/ui';
import type { ReactNode } from 'react';
import { PAGE_WIDTH } from '../../lib/page-width';

/**
 * One setting: its name and a one-line hint on the left, its control on the right. A row with
 * several controls is a `group` named by the setting, so each control's own label can be short.
 */
export function SettingRow({
  name,
  hint,
  group = false,
  children,
}: {
  name: string;
  hint: string;
  group?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={group ? 'group' : undefined}
      aria-label={group ? name : undefined}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border py-4 first:border-t-0"
    >
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
    <section aria-label={title} className={cn('flex flex-col gap-3', PAGE_WIDTH)}>
      {/* The open section's name is its title, on the sidebar title's line, as on every screen. */}
      <h2 className="flex min-h-control-sm items-center text-title">{title}</h2>
      <div className="flex flex-col rounded-xl bg-surface px-5">{children}</div>
    </section>
  );
}
