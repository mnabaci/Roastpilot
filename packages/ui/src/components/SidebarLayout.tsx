import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface SidebarLayoutProps {
  /** The screen title, on top of the sidebar. */
  title: string;
  /** The list (a NavList or RoastList), plus anything that goes under it. */
  sidebar: ReactNode;
  /** Names the content area for screen readers. */
  contentLabel: string;
  /** The open item. */
  children: ReactNode;
  className?: string;
}

/**
 * Every list-and-detail screen: the list on the left at the shared width, the open item on the
 * right; both scroll on their own (design system: SidebarLayout).
 */
export function SidebarLayout({
  title,
  sidebar,
  contentLabel,
  children,
  className,
}: SidebarLayoutProps) {
  return (
    <main className={cn('flex min-h-0 flex-1 overflow-hidden', className)}>
      <nav aria-label={title} className="flex w-sidebar shrink-0 flex-col gap-3 py-6 pl-6">
        <h1 className="text-title">{title}</h1>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">{sidebar}</div>
      </nav>
      {/* Relative, so screen-reader-only labels inside scroll with the content. */}
      <section
        aria-label={contentLabel}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-6"
      >
        {children}
      </section>
    </main>
  );
}
