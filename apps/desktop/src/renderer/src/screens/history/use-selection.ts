import type { RoastId } from '@roastpilot/shared';
import { useState } from 'react';

/** Select mode on the roast list: ticks, with Shift ticking the range from the last one. */
export function useSelection(order: readonly RoastId[]): {
  selecting: boolean;
  checked: ReadonlySet<RoastId>;
  start: () => void;
  done: () => void;
  check: (id: RoastId, range: boolean) => void;
} {
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<RoastId>>(new Set());
  const [last, setLast] = useState<RoastId>();
  const check = (id: RoastId, range: boolean) => {
    const next = new Set(checked);
    const [from, to] = [order.indexOf(last ?? id), order.indexOf(id)];
    if (range && last !== undefined && from !== -1 && to !== -1) {
      for (const each of order.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(each);
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
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
      setChecked(new Set());
      setLast(undefined);
    },
    check,
  };
}
