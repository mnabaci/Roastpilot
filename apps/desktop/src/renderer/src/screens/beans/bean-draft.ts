import {
  BeanFieldsSchema,
  type Bean,
  type BeanFields,
  type BeanProcess,
  type BeanSpecies,
  type Result,
  type SpecSheetFields,
} from '@roastpilot/shared';

/** The bean form's cells, as typed. */
export interface BeanDraft {
  name: string;
  origin: string;
  process: BeanProcess;
  /** `''` until you pick one. */
  species: BeanSpecies | '';
  variety: string;
  altitudeM: string;
  densityGL: string;
  moisturePct: string;
  screen: string;
  decaf: boolean;
  supplier: string;
  link: string;
  lowStockG: string;
  notes: string;
}

export type BeanDraftErrors = Readonly<Partial<Record<keyof BeanDraft, string>>>;

const DEFAULT_LOW_STOCK_G = 500;

const text = (value: number | string | null): string => (value === null ? '' : String(value));

export function toBeanDraft(bean: Bean | undefined): BeanDraft {
  return {
    name: bean?.name ?? '',
    origin: bean?.origin ?? '',
    process: bean?.process ?? 'washed',
    species: bean?.species ?? '',
    variety: text(bean?.variety ?? null),
    altitudeM: text(bean?.altitudeM ?? null),
    densityGL: text(bean?.densityGL ?? null),
    moisturePct: text(bean?.moisturePct ?? null),
    screen: text(bean?.screen ?? null),
    decaf: bean?.decaf ?? false,
    supplier: text(bean?.supplier ?? null),
    link: text(bean?.link ?? null),
    lowStockG: text(bean?.lowStockG ?? DEFAULT_LOW_STOCK_G),
    notes: text(bean?.notes ?? null),
  };
}

const optionalText = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** The bean a draft makes, or a message per cell. An empty optional cell is no value. */
export function fromBeanDraft(draft: BeanDraft): Result<BeanFields, BeanDraftErrors> {
  const errors: Partial<Record<keyof BeanDraft, string>> = {};
  const number = (cell: keyof BeanDraft): number | null => {
    const typed = String(draft[cell]).trim();
    if (typed === '') return null;
    const value = Number(typed);
    if (!Number.isFinite(value)) errors[cell] = 'Enter a number';
    return value;
  };
  const candidate = {
    name: draft.name,
    origin: draft.origin,
    process: draft.process,
    species: draft.species === '' ? null : draft.species,
    decaf: draft.decaf,
    variety: optionalText(draft.variety),
    supplier: optionalText(draft.supplier),
    link: optionalText(draft.link),
    notes: optionalText(draft.notes),
    altitudeM: number('altitudeM'),
    densityGL: number('densityGL'),
    moisturePct: number('moisturePct'),
    screen: number('screen'),
    lowStockG: number('lowStockG') ?? DEFAULT_LOW_STOCK_G,
  };
  const parsed = BeanFieldsSchema.safeParse(candidate);
  if (Object.keys(errors).length === 0 && parsed.success) return { ok: true, value: parsed.data };
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const cell = issue.path[0] as keyof BeanDraft;
      errors[cell] ??= issue.message;
    }
  }
  return { ok: false, error: errors };
}

/**
 * What a spec sheet fills in the bean form (docs/spec/beans-favourites-ghost.md, Fill from a spec
 * sheet): only empty cells, so nothing you typed changes. Process and decaf have no empty state,
 * so the sheet sets them only on a new bean, while still as the form started.
 */
export function fillFromSheet(
  draft: BeanDraft,
  sheet: SpecSheetFields,
  { isNew }: { isNew: boolean },
): { cells: Partial<BeanDraft>; count: number } {
  const blank = toBeanDraft(undefined);
  const cells: Partial<BeanDraft> = {};
  const fill = <K extends keyof BeanDraft>(cell: K, value: BeanDraft[K] | undefined) => {
    if (value === undefined) return;
    const empty = typeof draft[cell] === 'string' ? draft[cell] === '' : false;
    const untouchedNew = isNew && draft[cell] === blank[cell];
    if (empty || (untouchedNew && (cell === 'process' || cell === 'decaf'))) cells[cell] = value;
  };
  const asText = (value: number | string | null | undefined) =>
    value === null || value === undefined ? undefined : String(value);
  if (isNew) fill('name', asText(sheet.name));
  fill('origin', asText(sheet.origin));
  fill('process', sheet.process);
  fill('species', sheet.species ?? undefined);
  fill('variety', asText(sheet.variety));
  fill('altitudeM', asText(sheet.altitudeM));
  fill('densityGL', asText(sheet.densityGL));
  fill('moisturePct', asText(sheet.moisturePct));
  fill('screen', asText(sheet.screen));
  fill('decaf', sheet.decaf);
  fill('supplier', asText(sheet.supplier));
  fill('notes', asText(sheet.notes));
  // A cell set to what it already holds isn't a fill.
  const changed = Object.fromEntries(
    Object.entries(cells).filter(([cell, value]) => draft[cell as keyof BeanDraft] !== value),
  ) as Partial<BeanDraft>;
  return { cells: changed, count: Object.keys(changed).length };
}
