import type { RoastId } from '@roastpilot/shared';
import { useState } from 'react';

/**
 * Select mode on the roast list: ticks, with Shift ticking the range from the last one. `order` is
 * the list as shown; `existing` every saved roast, so a tick on a filtered-out roast stays, and one
 * on a deleted roast goes.
 */
export function useSelection(
  order: readonly RoastId[],
  existing: readonly RoastId[],
): {
  selecting: boolean;
  checked: ReadonlySet<RoastId>;
  start: () => void;
  done: () => void;
  check: (id: RoastId, range: boolean) => void;
} {
  const [selecting, setSelecting] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<RoastId>>(new Set());
  const [last, setLast] = useState<RoastId>();
  const kept = [...ticked].filter((id) => existing.includes(id));
  const checked: ReadonlySet<RoastId> = kept.length === ticked.size ? ticked : new Set(kept);
  const check = (id: RoastId, range: boolean) => {
    const next = new Set(checked);
    const [from, to] = [order.indexOf(last ?? id), order.indexOf(id)];
    if (range && last !== undefined && from !== -1 && to !== -1) {
      for (const each of order.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(each);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
    setLast(id);
  };
  return {
    selecting,
    checked,
    start: () => {
      setSelecting(true);
    },
    done: () => {
      setSelecting(false);
      setTicked(new Set());
      setLast(undefined);
    },
    check,
  };
}
