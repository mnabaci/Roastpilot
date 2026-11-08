import {
  err,
  FileRoastSchema,
  FileRoastV2Schema,
  ok,
  readEnvelope,
  toEnvelope,
  type EnvelopeProblem,
  type FileRoast,
  type Result,
  type RoastDetail,
  type RoastFileV2,
} from '@roastpilot/shared';
import { fromColumns, toColumns } from './sample-columns';

/** Names by id, so a file carries the bean and roaster by name. */
export interface Names {
  beans: ReadonlyMap<number, string>;
  roasters: ReadonlyMap<number, string>;
}

const nameOf = (names: ReadonlyMap<number, string>, id: number | null): string | null =>
  id === null ? null : (names.get(id) ?? null);

/** Saved roasts as a Roastpilot file, version 2 (docs/spec/data-model.md, Roastpilot roast files). */
export function toRoastFile(roasts: readonly RoastDetail[], names: Names, now: Date): RoastFileV2 {
  const items = roasts.map((roast) => {
    // The schema keeps only what a file carries: ids stay behind.
    const carried = FileRoastSchema.parse({
      ...roast,
      beanName: nameOf(names.beans, roast.beanId),
      roasterName: nameOf(names.roasters, roast.roasterId),
    });
    return { ...carried, samples: toColumns(carried.samples) };
  });
  return toEnvelope('roasts', items, now);
}

/** A file's roasts as History keeps them, whichever version wrote them; undefined if one is bad. */
function roastsOf(version: number, items: unknown[]): FileRoast[] | undefined {
  const roasts: FileRoast[] = [];
  for (const item of items) {
    if (version === 1) {
      const v1 = FileRoastSchema.safeParse(item);
      if (!v1.success) return undefined;
      roasts.push(v1.data);
      continue;
    }
    const v2 = FileRoastV2Schema.safeParse(item);
    if (!v2.success) return undefined;
    roasts.push({ ...v2.data, samples: fromColumns(v2.data.samples) });
  }
  return roasts;
}

/** Why a roast file is refused: its envelope, or a roast in it that isn't one. */
export type RoastFileProblem = EnvelopeProblem;

/** A Roastpilot file's roasts, or why the whole file is refused. */
export function parseRoastFile(text: string): Result<FileRoast[], RoastFileProblem> {
  const envelope = readEnvelope(text, 'roasts');
  if (!envelope.ok) return envelope;
  const roasts = roastsOf(envelope.value.version, envelope.value.items);
  return roasts ? ok(roasts) : err({ kind: 'not-roastpilot' });
}

/** The id of the one with exactly this name, if any. */
export function idByName(names: ReadonlyMap<number, string>, name: string | null): number | null {
  if (name === null) return null;
  for (const [id, candidate] of names) if (candidate === name) return id;
  return null;
}
