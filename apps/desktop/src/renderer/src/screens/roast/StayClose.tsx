import { cn } from '@roastpilot/ui';
import { TriangleAlert } from 'lucide-react';

/**
 * "Stay with the roaster while it runs" (docs/spec/ui.md, Roast screen): a caution line right
 * above the action before a roast, then a quiet one under the controls while it runs. Amber, not
 * red: red is for safety trips.
 */
export function StayClose({ caution = false }: { caution?: boolean }) {
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-label',
        caution ? 'font-semibold text-warning' : 'text-ink-muted',
      )}
    >
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
      Stay with the roaster while it runs
    </p>
  );
}
