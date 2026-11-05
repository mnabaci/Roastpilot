import {
  BeanFieldsSchema,
  type Bean,
  type BeanFields,
  type BeanProcess,
  type Result,
} from '@roastpilot/shared';

/** The bean form's cells, as typed. */
export interface BeanDraft {
  name: string;
  origin: string;
  process: BeanProcess;
  variety: string;
  altitudeM: string;
  densityGL: string;
  moisturePct: string;
  screen: string;
  decaf: boolean;
  supplier: string;
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
    variety: text(bean?.variety ?? null),
    altitudeM: text(bean?.altitudeM ?? null),
    densityGL: text(bean?.densityGL ?? null),
    moisturePct: text(bean?.moisturePct ?? null),
    screen: text(bean?.screen ?? null),
    decaf: bean?.decaf ?? false,
    supplier: text(bean?.supplier ?? null),
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
    decaf: draft.decaf,
    variety: optionalText(draft.variety),
    supplier: optionalText(draft.supplier),
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
