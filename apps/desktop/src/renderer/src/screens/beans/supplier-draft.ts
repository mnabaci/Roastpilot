import {
  SupplierFieldsSchema,
  type Result,
  type Supplier,
  type SupplierFields,
} from '@roastpilot/shared';

/** The supplier form's cells, as typed. */
export interface SupplierDraft {
  name: string;
  website: string;
  email: string;
  phone: string;
  notes: string;
}

export type SupplierDraftErrors = Readonly<Partial<Record<keyof SupplierDraft, string>>>;

export const toSupplierDraft = (supplier: Supplier | undefined): SupplierDraft => ({
  name: supplier?.name ?? '',
  website: supplier?.website ?? '',
  email: supplier?.email ?? '',
  phone: supplier?.phone ?? '',
  notes: supplier?.notes ?? '',
});

const optional = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** The supplier a draft makes, or a message per cell. An empty optional cell is no value. */
export function fromSupplierDraft(
  draft: SupplierDraft,
): Result<SupplierFields, SupplierDraftErrors> {
  const parsed = SupplierFieldsSchema.safeParse({
    name: draft.name,
    website: optional(draft.website),
    email: optional(draft.email),
    phone: optional(draft.phone),
    notes: optional(draft.notes),
  });
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<keyof SupplierDraft, string>> = {};
  for (const issue of parsed.error.issues) {
    errors[issue.path[0] as keyof SupplierDraft] ??= issue.message;
  }
  return { ok: false, error: errors };
}

/** "1 bean", "3 beans": how many beans name a supplier, archived ones too. */
export const beanCount = (n: number): string => `${String(n)} ${n === 1 ? 'bean' : 'beans'}`;
