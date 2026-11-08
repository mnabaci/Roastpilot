import { FILE_KINDS, sayInUnit, type FileKind, type TemperatureUnit } from '@roastpilot/shared';

/** One and many of each kind, as the toasts say it. */
const NOUNS: Readonly<Record<FileKind, readonly [string, string]>> = {
  roasts: ['roast', 'roasts'],
  beans: ['bean', 'beans'],
  profiles: ['profile', 'profiles'],
  roasters: ['roaster', 'roasters'],
};

/**
 * "Imported 3 profiles · 1 was already here", and "· 1 is archived" for a bean that is here but
 * hidden (docs/spec/data-model.md).
 */
export function importedText(kind: FileKind, added: number, skipped: number, archived = 0): string {
  const [one, many] = NOUNS[kind];
  const parts = [`Imported ${String(added)} ${added === 1 ? one : many}`];
  if (skipped > 0) parts.push(`${String(skipped)} ${skipped === 1 ? 'was' : 'were'} already here`);
  if (archived > 0) parts.push(`${String(archived)} ${archived === 1 ? 'is' : 'are'} archived`);
  return parts.join(' · ');
}

/** Why an import was refused, as the main process says it. */
export type ImportProblem =
  | { kind: 'wrong-kind'; fileKind: FileKind }
  | { kind: 'bad-item'; name: string; reason: string }
  | { kind: string };

const PROBLEMS: Readonly<Record<string, string>> = {
  'not-artisan': "That file isn't an Artisan roast",
  'not-roastpilot': "That file isn't a Roastpilot file",
  'newer-version': 'That file is from a newer Roastpilot · update to import it',
  'read-failed': "Couldn't read that file · see Logs",
  'too-big': 'That file is too big · Roastpilot files are under 50 MB',
  empty: 'Nothing to import · the file is empty',
};

/** One line for the error toast: why the whole file was refused, temperatures in `unit`. */
export function importProblemText(problem: ImportProblem, unit: TemperatureUnit): string {
  if ('fileKind' in problem) {
    const { screen } = FILE_KINDS[problem.fileKind];
    return `This is a ${NOUNS[problem.fileKind][1]} file · import it on ${screen}`;
  }
  if ('reason' in problem) {
    return `"${problem.name}" can't come in · ${sayInUnit(problem.reason, unit)}`;
  }
  return PROBLEMS[problem.kind] ?? "Couldn't import · see Logs";
}

/** One line for the error toast when an export fails. */
export function exportProblemText(problem: { kind: string }): string {
  return problem.kind === 'not-found'
    ? 'Nothing to export · it was deleted'
    : "Couldn't export · see Logs";
}
