import type { ReactNode } from 'react';
import { FolderOpen, RotateCw, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface ErrorStateProps {
  /** What broke: "Settings hit a problem". */
  title: string;
  /** The error's own message, one line; the full text is in the log. */
  detail?: string | undefined;
  onReload: () => void;
  onOpenLogs: () => void;
  /** Above Reload: the whole-window page puts Emergency stop here. */
  before?: ReactNode;
  className?: string;
}

/** What shows instead of a screen that failed to draw (design system: ErrorState). */
export function ErrorState({
  title,
  detail,
  onReload,
  onOpenLogs,
  before,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex w-full max-w-120 flex-col items-center gap-4 px-5 py-8 text-center',
        className,
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-8 text-warning" />
      <h2 className="text-heading">{title}</h2>
      {detail ? (
        <p title={detail} className="max-w-full truncate text-body text-ink-muted">
          {detail}
        </p>
      ) : null}
      {before}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="primary" icon={<RotateCw aria-hidden="true" />} onClick={onReload}>
          Reload
        </Button>
        <Button variant="ghost" icon={<FolderOpen aria-hidden="true" />} onClick={onOpenLogs}>
          Open log folder
        </Button>
      </div>
    </div>
  );
}
