import type { AutoProfile } from '@roastpilot/shared';

/** `base`, or `base 2`, `base 3`… : the first name not in `taken`. */
export function freeName(base: string, taken: ReadonlySet<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${String(n)}`;
  return name;
}

export type CopyPlan =
  { kind: 'name'; name: string } | { kind: 'already-copied'; profile: AutoProfile };

/**
 * How a copy of `source` lands on another roaster (docs/spec/roasters.md): once per roaster, named
 * after the roaster it came from ("Light · Steps (from Simulator)"), clear of the names there.
 */
export function planCopy(
  source: AutoProfile,
  there: readonly AutoProfile[],
  builtInsThere: readonly AutoProfile[],
  fromName: string | undefined,
): CopyPlan {
  const earlier = there.find(
    (p) => p.source?.kind === 'profile' && p.source.profileId === source.id,
  );
  if (earlier) return { kind: 'already-copied', profile: earlier };
  const base = fromName ? `${source.name} (from ${fromName})` : source.name;
  return {
    kind: 'name',
    name: freeName(base, new Set([...builtInsThere, ...there].map((p) => p.name))),
  };
}
