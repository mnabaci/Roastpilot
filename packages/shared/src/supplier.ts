import { z } from 'zod';
import { WebLinkSchema } from './bean';
import type { StorageError } from './saved-roast';

// Who you buy green coffee from, kept once and picked on each bean (docs/spec/data-model.md,
// Suppliers; docs/spec/beans-favourites-ghost.md, Suppliers).

export const SupplierIdSchema = z.number().int().positive();

/** The longest supplier name: the same as a bean's `supplier`. */
const SUPPLIER_NAME_MAX = 120;

/** What you keep about a supplier. */
export const SupplierFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(SUPPLIER_NAME_MAX),
  /** Its own site, http or https; a bean's order link is that bean's page. */
  website: WebLinkSchema.nullable(),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email({ error: 'Enter an email address, like sales@example.com' }))
    .nullable(),
  phone: z.string().trim().max(40, 'At most 40 characters').nullable(),
  notes: z.string().max(2000).nullable(),
});

export const SupplierSchema = SupplierFieldsSchema.extend({ id: SupplierIdSchema });

export const UpdateSupplierSchema = z.object({
  id: SupplierIdSchema,
  fields: SupplierFieldsSchema,
});

/** One supplier whatever the case or outer spaces: "Falcon " and "falcon" are one. */
const sameSupplierName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The supplier with this name, in any case, if you have one. */
export const supplierNamed = <S extends { name: string }>(
  suppliers: readonly S[],
  name: string,
): S | undefined => suppliers.find((s) => sameSupplierName(s.name, name));

/** Why a supplier wasn't added, changed or deleted. */
export type SupplierError =
  | StorageError
  /** Another supplier has that name, in some case. */
  | { kind: 'name-taken'; name: string }
  /** Deleting one that beans still name: archived beans count. */
  | { kind: 'has-beans'; beans: number };

/** Why a supplier's website didn't open. */
export type OpenSupplierWebsiteError =
  | { kind: 'supplier-not-found'; id: number }
  | { kind: 'no-website'; id: number }
  | { kind: 'storage-failed'; message: string }
  | { kind: 'open-failed' };

export type SupplierId = z.infer<typeof SupplierIdSchema>;
export type SupplierFields = z.infer<typeof SupplierFieldsSchema>;
export type Supplier = z.infer<typeof SupplierSchema>;
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;
