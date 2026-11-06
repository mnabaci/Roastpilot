import {
  err,
  FileRoastSchema,
  ok,
  ROAST_FILE_FORMAT,
  ROAST_FILE_VERSION,
  RoastFileSchema,
  type FileRoast,
  type Result,
  type RoastDetail,
  type RoastFile,
} from '@roastpilot/shared';

/** Names by id, so a file carries the bean and roaster by name. */
export interface Names {
  beans: ReadonlyMap<number, string>;
  roasters: ReadonlyMap<number, string>;
}

const nameOf = (names: ReadonlyMap<number, string>, id: number | null): string | null =>
  id === null ? null : (names.get(id) ?? null);

/** Saved roasts as a Roastpilot file (docs/spec/data-model.md, Roastpilot roast files). */
export function toRoastFile(roasts: readonly RoastDetail[], names: Names, now: Date): RoastFile {
  return {
    format: ROAST_FILE_FORMAT,
    version: ROAST_FILE_VERSION,
    exportedAt: now.toISOString(),
    // The schema keeps only what a file carries: ids stay behind.
    roasts: roasts.map((roast) =>
      FileRoastSchema.parse({
        ...roast,
        beanName: nameOf(names.beans, roast.beanId),
        roasterName: nameOf(names.roasters, roast.roasterId),
      }),
    ),
  };
}

export type RoastFileProblem = 'not-roastpilot' | 'newer-version';

/** A Roastpilot file's roasts, or why the whole file is refused. */
export function parseRoastFile(text: string): Result<FileRoast[], RoastFileProblem> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON at all: it isn't one of our files.
    return err('not-roastpilot');
  }
  const version = (json as { version?: unknown } | null)?.version;
  if (typeof version === 'number' && version > ROAST_FILE_VERSION) return err('newer-version');
  const parsed = RoastFileSchema.safeParse(json);
  return parsed.success ? ok(parsed.data.roasts) : err('not-roastpilot');
}

/** The id of the one with exactly this name, if any. */
export function idByName(names: ReadonlyMap<number, string>, name: string | null): number | null {
  if (name === null) return null;
  for (const [id, candidate] of names) if (candidate === name) return id;
  return null;
}
