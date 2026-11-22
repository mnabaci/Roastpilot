import { supplierNamed, type Supplier } from '@roastpilot/shared';
import type { SelectOption } from '@roastpilot/ui';
import { siteOf } from './bean-detail';

/** How to reach a supplier, in one line: "sales@falcon.coffee · +44 1234 567890". */
export const contactsOf = (supplier: Pick<Supplier, 'email' | 'phone'>): string =>
  [supplier.email, supplier.phone].filter((c) => c !== null && c !== '').join(' · ');

/**
 * The Supplier picker's list (docs/spec/beans-favourites-ghost.md, Suppliers): None, your
 * suppliers by name with their site, and a name you added here, not saved yet, marked New.
 * `value` is the supplier as the list spells it.
 */
export function supplierOptions(
  suppliers: readonly Supplier[],
  typed: string,
): { options: SelectOption<string>[]; value: string; isNew: boolean } {
  const name = typed.trim();
  const known = name === '' ? undefined : supplierNamed(suppliers, name);
  const isNew = name !== '' && known === undefined;
  const options: SelectOption<string>[] = [
    { value: '', label: 'None' },
    ...suppliers.map((s) => ({
      value: s.name,
      label: s.name,
      ...(s.website ? { detail: siteOf(s.website) } : {}),
    })),
    ...(isNew ? [{ value: name, label: name, badge: 'New' }] : []),
  ];
  return { options, value: known?.name ?? name, isNew };
}
