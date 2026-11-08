/** What an import adds, each under the name it gets, and how many were already here. */
export interface ImportPlan<Item> {
  add: Item[];
  /** Already here and shown. */
  skipped: number;
  /** Already here, but archived: hidden until you show archived ones. */
  archived: number;
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
 * The file is taken in order, so a repeat inside it counts as already here. One that matches an
 * archived item counts apart, as you can't see it.
 */
export function planImport<Item>({
  items,
  here,
  archived = [],
  nameOf,
  withName,
  contentOf,
  maxName,
}: {
  items: readonly Item[];
  here: readonly Item[];
  /** Here too, but archived. */
  archived?: readonly Item[];
  nameOf: (item: Item) => string;
  withName: (item: Item, name: string) => Item;
  /** What counts as the same: the item without what an import changes anyway. */
  contentOf: (item: Item) => unknown;
  maxName: number;
}): ImportPlan<Item> {
  const byName = new Map([...archived, ...here].map((item) => [nameOf(item), contentOf(item)]));
  const archivedNames = new Set(archived.map(nameOf));
  const add: Item[] = [];
  let skipped = 0;
  let archivedCount = 0;
  for (const item of items) {
    const name = nameOf(item);
    const content = contentOf(item);
    const names = [name];
    for (let n = 1; byName.has(names[names.length - 1] ?? name); n++) {
      names.push(importedName(name, n, maxName));
    }
    // Every name it might already be under, then the first free one.
    const free = names.pop() ?? name;
    const same = names.find((taken) => sameContent(byName.get(taken), content));
    if (same !== undefined) {
      if (archivedNames.has(same)) archivedCount += 1;
      else skipped += 1;
      continue;
    }
    byName.set(free, content);
    add.push(free === name ? item : withName(item, free));
  }
  return { add, skipped, archived: archivedCount };
}
