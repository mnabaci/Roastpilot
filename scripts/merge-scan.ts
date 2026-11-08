// What a merge brings that git won't flag (.claude/skills/merge/SKILL.md): decisions both sides
// changed, files both touched, code this branch moved that the other side still uses, interfaces
// that gained required members, and files the merge would make too long. Reads only; changes
// nothing.
//
// Run with: pnpm merge:scan <incoming>   (e.g. origin/main, or another agent's branch)
import { spawnSync } from 'node:child_process';
import {
  addedMembers,
  decisionFiles,
  overSize,
  parseNameStatus,
  parseNumstat,
  removedDeclarations,
  staleReferences,
  type Change,
} from './merge-scan-lib.ts';

const LIMIT = 200;
const incoming = process.argv[2];
if (incoming === undefined || incoming.startsWith('-')) {
  process.stderr.write('Usage: pnpm merge:scan <incoming branch or ref>\n');
  process.exit(2);
}

function git(...args: string[]): string {
  const run = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    process.stderr.write(`git ${args.join(' ')} failed: ${run.stderr}`);
    process.exit(1);
  }
  return run.stdout;
}

/** A file at a commit, or '' when it isn't there. */
function show(ref: string, path: string): string {
  const run = spawnSync('git', ['show', `${ref}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return run.status === 0 ? run.stdout : '';
}

/** Lines a side added, per file, and every line it removed. */
function diffLines(
  base: string,
  ref: string,
): { added: Map<string, string[]>; removed: Map<string, string[]> } {
  const added = new Map<string, string[]>();
  const removed = new Map<string, string[]>();
  let file: string | undefined;
  let old: string | undefined;
  for (const line of git('diff', '-M', '-U0', base, ref).split(/\r?\n/)) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? undefined : line.slice(6);
      if (file !== undefined) added.set(file, []);
    } else if (line.startsWith('--- ')) {
      old = line === '--- /dev/null' ? undefined : line.slice(6);
    } else if (old !== undefined && line.startsWith('-')) {
      removed.set(old, [...(removed.get(old) ?? []), line.slice(1)]);
    } else if (file !== undefined && line.startsWith('+')) {
      added.get(file)?.push(line.slice(1));
    }
  }
  return { added, removed };
}

const base = git('merge-base', 'HEAD', incoming).trim();
const ours = parseNameStatus(git('diff', '--name-status', '-M', base, 'HEAD'));
const theirs = parseNameStatus(git('diff', '--name-status', '-M', base, incoming));
const paths = (changes: readonly Change[]) => changes.map((change) => change.path);
const ourPaths = new Set(paths(ours));
const out: string[] = [`# Merge scan: ${incoming} into HEAD (base ${base.slice(0, 7)})`, ''];
const section = (title: string, lines: readonly string[]) => {
  out.push(`## ${title}`, ...(lines.length === 0 ? ['(none)'] : lines), '');
};

const ourDecisions = new Set(decisionFiles(paths(ours)));
section(
  'Decisions changed (read every incoming one in full)',
  decisionFiles(paths(theirs)).map((path) =>
    ourDecisions.has(path) ? `- ${path}  ← changed on both sides` : `- ${path}`,
  ),
);

const numstat = parseNumstat(git('diff', '--numstat', '-M', base, incoming));
section(
  'Files both sides changed',
  paths(theirs)
    .filter((path) => ourPaths.has(path))
    .map((path) => {
      const counts = numstat.get(path);
      return `- ${path}${counts ? `  (+${String(counts.added)} −${String(counts.removed)} incoming)` : ''}`;
    }),
);

const theirLines = diffLines(base, incoming);
const ourLines = diffLines(base, 'HEAD');
section('Moved or deleted here, still used there', [
  ...staleReferences(ours, theirLines.added).map(
    ({ file, gone, now, line }) =>
      `- ${file}: ${gone} is ${now ? `now ${now}` : 'deleted'} · ${line}`,
  ),
  ...removedDeclarations(ourLines.removed, ourLines.added, theirLines.added).map(
    ({ file, name, from, now, line }) =>
      `- ${file}: uses ${name}, which this branch took out of ${from}${now ? ` (now in ${now})` : ''} · ${line}`,
  ),
]);

section(
  'Interfaces that gained required members (check fakes and callers on both sides)',
  [...theirs, ...ours]
    .filter((change) => /\.tsx?$/.test(change.path) && change.status !== 'D')
    .flatMap((change) => {
      const side = theirs.includes(change) ? incoming : 'HEAD';
      return addedMembers(show(base, change.from ?? change.path), show(side, change.path)).map(
        ({ name, members }) =>
          `- ${name} (${change.path}, ${side === 'HEAD' ? 'this branch' : 'incoming'}): ${members.join(', ')}`,
      );
    }),
);

const lines = new Map(
  paths(theirs).map((path) => {
    const text = show('HEAD', path);
    return [path, text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)];
  }),
);
section(
  `Code files the merge would take past ~${String(LIMIT)} lines`,
  overSize(lines, numstat, LIMIT).map(
    ({ file, lines: count, before }) =>
      `- ${file}: about ${String(count)}${before > LIMIT ? ` (already ${String(before)} here)` : ''}`,
  ),
);

process.stdout.write(`${out.join('\n')}\n`);
