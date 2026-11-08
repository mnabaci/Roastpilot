/** What an import adds, each under the name it gets, and how many were already here. */
export interface ImportPlan<Item> {
  add: Item[];
  skipped: number;
}

/** "Guji (imported)", then "Guji (imported 2)"…, the name shortened so it fits in `maxName`. */
export function importedName(name: string, n: number, maxName: number): string {
  const suffix = n === 1 ? ' (imported)' : ` (imported ${String(n)})`;
  return `${name.slice(0, Math.max(1, maxName - suffix.length)).trimEnd()}${suffix}`;
}

/** Plain data as one string, object keys sorted, so key order never makes two things differ. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sameContent(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

/**
 * The import rules (docs/spec/data-model.md, Beans, profiles and roasters files): the same name
 * and content is skipped, also when an earlier import gave it "(imported)"; the same name with
 * other content comes in as "<name> (imported)", then "(imported 2)"…; nothing is overwritten.
 * The file is taken in order, so a repeat inside it counts as already here.
 */
export function planImport<Item>({
  items,
  here,
  nameOf,
  withName,
  contentOf,
  maxName,
}: {
  items: readonly Item[];
  here: readonly Item[];
  nameOf: (item: Item) => string;
  withName: (item: Item, name: string) => Item;
  /** What counts as the same: the item without what an import changes anyway. */
  contentOf: (item: Item) => unknown;
  maxName: number;
}): ImportPlan<Item> {
  const byName = new Map(here.map((item) => [nameOf(item), contentOf(item)]));
  const add: Item[] = [];
  let skipped = 0;
  for (const item of items) {
    const name = nameOf(item);
    const content = contentOf(item);
    const names = [name];
    for (let n = 1; byName.has(names[names.length - 1] ?? name); n++) {
      names.push(importedName(name, n, maxName));
    }
    // Every name it might already be under, then the first free one.
    const free = names.pop() ?? name;
    if (names.some((taken) => sameContent(byName.get(taken), content))) {
      skipped += 1;
      continue;
    }
    byName.set(free, content);
    add.push(free === name ? item : withName(item, free));
  }
  return { add, skipped };
}
