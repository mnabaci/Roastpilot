import { Check } from 'lucide-react';
import { cn } from '../lib/utils';

/** The box a row shows in Select mode, ticked or not; the row itself is the checkbox. */
export function TickBox({ ticked }: { ticked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-sm border',
        ticked ? 'border-heat bg-heat-tint text-heat' : 'border-border-strong',
      )}
    >
      {ticked ? <Check className="size-4" /> : null}
    </span>
  );
}
