// Pure helpers for the merge scan (.claude/skills/merge/SKILL.md): read git's output about both
// sides of a merge and find what git won't flag: decisions both changed, code one side moved that
// the other still uses, interfaces that gained members, and files a merge would make too long.

export interface Change {
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'T';
  path: string;
  /** Where a renamed or copied file came from. */
  from?: string;
}

/** `git diff --name-status -M` output. */
export function parseNameStatus(out: string): Change[] {
  return out
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [code = '', first = '', second] = line.split('\t');
      const status = code.charAt(0) as Change['status'];
      return second === undefined ? { status, path: first } : { status, path: second, from: first };
    });
}

export interface LineCounts {
  added: number;
  removed: number;
}

/** `git diff --numstat -M` output; a binary file counts as no lines. */
export function parseNumstat(out: string): Map<string, LineCounts> {
  const counts = new Map<string, LineCounts>();
  for (const line of out.split(/\r?\n/)) {
    const [added, removed, path] = line.split('\t');
    if (added === undefined || removed === undefined || path === undefined) continue;
    counts.set(path, { added: Number(added) || 0, removed: Number(removed) || 0 });
  }
  return counts;
}

const DECISIONS = [
  /^docs\/spec\//,
  /^docs\/adr\//,
  /(^|\/)AGENTS\.md$/,
  /^\.claude\/skills\//,
  /^docs\/design-system\/README\.md$/,
];

/** Files that record decisions: specs, ADRs, AGENTS files, skills and the brand book. */
export function decisionFiles(paths: readonly string[]): string[] {
  return paths.filter((path) => DECISIONS.some((pattern) => pattern.test(path)));
}

export interface StaleReference {
  /** The incoming file that still uses it. */
  file: string;
  /** The path this branch moved or deleted. */
  gone: string;
  /** Where it went, when it was moved. */
  now: string | undefined;
  line: string;
}

const stemOf = (path: string) => (path.split('/').pop() ?? path).replace(/\.tsx?$/, '');
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Incoming lines that import or name a module this branch moved or deleted, and incoming changes
 * to such a file itself. `incoming` maps each file to the lines the other side added.
 */
export function staleReferences(
  ours: readonly Change[],
  incoming: ReadonlyMap<string, readonly string[]>,
): StaleReference[] {
  const gone = ours.flatMap((change): { gone: string; now: string | undefined }[] => {
    if (change.status === 'R' && change.from) return [{ gone: change.from, now: change.path }];
    if (change.status === 'D') return [{ gone: change.path, now: undefined }];
    return [];
  });
  const found: StaleReference[] = [];
  for (const [file, lines] of incoming) {
    for (const { gone: path, now } of gone) {
      if (file === path) {
        found.push({ file, gone: path, now, line: '(changed on the other side)' });
        continue;
      }
      const specifier = new RegExp(`/${escape(stemOf(path))}(\\.tsx?)?['"]`);
      const line = lines.find((text) => specifier.test(text));
      if (line !== undefined) found.push({ file, gone: path, now, line: line.trim() });
    }
  }
  return found;
}

interface Member {
  name: string;
  optional: boolean;
}

function interfaces(source: string): Map<string, Member[]> {
  const found = new Map<string, Member[]>();
  let current: { name: string; members: Member[] } | undefined;
  for (const line of source.split(/\r?\n/)) {
    if (current === undefined) {
      const start = /^(?:export\s+)?interface\s+(\w+)[^{]*\{\s*$/.exec(line);
      if (start?.[1]) current = { name: start[1], members: [] };
      continue;
    }
    if (line.startsWith('}')) {
      found.set(current.name, current.members);
      current = undefined;
      continue;
    }
    const member = /^\s+(?:readonly\s+)?([A-Za-z_$#][\w$]*)(\?)?\s*:/.exec(line);
    if (member?.[1]) current.members.push({ name: member[1], optional: member[2] === '?' });
  }
  return found;
}

/** Each top-level interface in a TypeScript source, with its member names. */
export function interfaceMembers(source: string): Map<string, string[]> {
  return new Map(
    [...interfaces(source)].map(([name, members]) => [name, members.map((m) => m.name)]),
  );
}

/**
 * Required members an interface gained between two versions of a file: every fake, caller and
 * constructor on the other side must now pass them. New interfaces have no callers yet.
 */
export function addedMembers(before: string, after: string): { name: string; members: string[] }[] {
  const old = interfaces(before);
  return [...interfaces(after)].flatMap(([name, members]) => {
    const had = old.get(name);
    if (had === undefined) return [];
    const known = new Set(had.map((m) => m.name));
    const gained = members.filter((m) => !m.optional && !known.has(m.name)).map((m) => m.name);
    return gained.length === 0 ? [] : [{ name, members: gained }];
  });
}

/**
 * Code files (tests left out) the merge would take past `limit` lines: this side's length plus
 * what the other side adds and removes, as git counts it.
 */
export function overSize(
  lines: ReadonlyMap<string, number>,
  incoming: ReadonlyMap<string, LineCounts>,
  limit: number,
): { file: string; lines: number; before: number }[] {
  return [...incoming].flatMap(([file, { added, removed }]) => {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) return [];
    const before = lines.get(file) ?? 0;
    const total = before + added - removed;
    return total > limit ? [{ file, lines: total, before }] : [];
  });
}

const DECLARATION = [
  /^\s*export\s+(?:async\s+)?function\s+(\w+)/,
  /^\s*export\s+(?:const|let|class|type|interface|enum)\s+(\w+)/,
  // A class member: two spaces in, a name, its parameters (never a string), then its body.
  /^ {2}(?:(?:public|private|static|readonly)\s+)*(?:async\s+)?(\w+)\s*\((?!['"`])[^)]*\)\s*(?::[^{]+)?\{\s*$/,
];
const CODE = /\.tsx?$/;
const TEST = /\.test\.tsx?$/;
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'constructor']);

function declaredNames(lines: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const line of lines) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    for (const pattern of DECLARATION) {
      const name = pattern.exec(line)?.[1];
      if (name !== undefined && !KEYWORDS.has(name)) names.add(name);
    }
  }
  return names;
}

/**
 * Functions, methods and exports this side took out of a file (and didn't declare again in that
 * file) that the other side's added lines still use; `now` is where this side declares it instead.
 */
export function removedDeclarations(
  ourRemoved: ReadonlyMap<string, readonly string[]>,
  ourAdded: ReadonlyMap<string, readonly string[]>,
  incoming: ReadonlyMap<string, readonly string[]>,
): { file: string; name: string; from: string; now: string | undefined; line: string }[] {
  const gone = [...ourRemoved].flatMap(([from, lines]) => {
    if (!CODE.test(from) || TEST.test(from)) return [];
    const kept = declaredNames(ourAdded.get(from) ?? []);
    return [...declaredNames(lines)]
      .filter((name) => !kept.has(name))
      .map((name) => {
        const now = [...ourAdded].find(([, added]) => declaredNames(added).has(name))?.[0];
        return { name, from, now };
      });
  });
  return [...incoming].flatMap(([file, lines]) =>
    !CODE.test(file)
      ? []
      : gone.flatMap(({ name, from, now }) => {
          const used = new RegExp(`\\b${name}\\b`);
          const line = lines.find((text) => used.test(text));
          return line === undefined ? [] : [{ file, name, from, now, line: line.trim() }];
        }),
  );
}
