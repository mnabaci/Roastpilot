/** A zod error, as zod's own `issues` list has it. */
interface Issues {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}

/** Why an item was refused, in one line: the first problem, and where it is in the item. */
export function problemOf({ issues }: Issues): string {
  const [first] = issues;
  if (!first) return 'Not a valid item';
  const where = first.path.map(String).join('.');
  return where === '' ? first.message : `${first.message} (${where})`;
}
