import { useState } from 'react';

/**
 * Select mode on a list (History, Profiles): ticks, with Shift ticking the range from the last
 * one. `order` is the list as shown, only the rows that can be ticked; `existing` every item, so a
 * tick on a filtered-out item stays, and one on a deleted item goes.
 */
export function useSelection<Id>(
  order: readonly Id[],
  existing: readonly Id[],
): {
  selecting: boolean;
  checked: ReadonlySet<Id>;
  start: () => void;
  done: () => void;
  check: (id: Id, range: boolean) => void;
} {
  const [selecting, setSelecting] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<Id>>(new Set());
  const [last, setLast] = useState<Id>();
  const kept = [...ticked].filter((id) => existing.includes(id));
  const checked: ReadonlySet<Id> = kept.length === ticked.size ? ticked : new Set(kept);
  const check = (id: Id, range: boolean) => {
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
