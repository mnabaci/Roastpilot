import { SpecSheetFieldsSchema, type RawSpecSheet, type SpecSheetFields } from '@roastpilot/shared';

/** Notes the bean form takes; longer lists are cut at a whole note. */
const NOTES_MAX = 4000;

/** "1,800–2,000 m" fills its middle; one end alone is used as it is. */
function altitude({ altitudeMinM: min, altitudeMaxM: max }: RawSpecSheet): number | null {
  if (min !== null && max !== null) return Math.round((min + max) / 2);
  return min ?? max;
}

/** Tasting notes as a list the bean's record shows as chips ("Dark Chocolate | Pecan"). */
function notes(tastingNotes: readonly string[]): string | null {
  const kept: string[] = [];
  let length = 0;
  for (const note of tastingNotes.map((n) => n.trim()).filter(Boolean)) {
    const added = (kept.length > 0 ? 3 : 0) + note.length;
    if (length + added > NOTES_MAX) break;
    kept.push(note);
    length += added;
  }
  return kept.length > 0 ? kept.join(' | ') : null;
}

/** Trimmed; blank is nothing. */
function text(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** A site as sheets print it ("www.falcon.coffee") as a web address: https when none is given. */
function website(value: string | null): string | null {
  const site = text(value);
  if (site === null) return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(site) ? site : `https://${site}`;
}

/**
 * What a sheet fills in the bean form (docs/spec/beans-favourites-ghost.md, Fill from a spec
 * sheet): only values it had, each checked as the form checks it. A value the form would refuse
 * is left out, never corrected.
 */
export function specSheetFields(raw: RawSpecSheet): SpecSheetFields {
  const candidates: Record<keyof SpecSheetFields, unknown> = {
    name: text(raw.name),
    origin: text(raw.origin),
    process: raw.process,
    species: raw.species,
    variety: text(raw.variety),
    altitudeM: altitude(raw),
    densityGL: raw.densityGL,
    moisturePct: raw.moisturePct,
    screen: raw.screen,
    decaf: raw.decaf,
    supplier: text(raw.supplier),
    supplierWebsite: website(raw.supplierWebsite),
    supplierEmail: text(raw.supplierEmail),
    supplierPhone: text(raw.supplierPhone),
    notes: notes(raw.tastingNotes),
  };
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (value === null || value === undefined) continue;
    const shape = SpecSheetFieldsSchema.shape[key as keyof SpecSheetFields];
    const checked = shape.safeParse(value);
    if (checked.success && checked.data !== undefined) fields[key] = checked.data;
  }
  return SpecSheetFieldsSchema.parse(fields);
}

/** Whether a sheet filled anything at all. */
export const isEmptySheet = (fields: SpecSheetFields): boolean => Object.keys(fields).length === 0;
