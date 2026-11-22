import type { Bean, Supplier, SupplierId } from '@roastpilot/shared';
import { Button, Dialog } from '@roastpilot/ui';
import { ChevronLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { useBeans } from '../../stores/use-stores';
import { siteOf } from './bean-detail';
import { beanCount } from './supplier-draft';
import { SupplierForm } from './SupplierForm';

type Page = { kind: 'list' } | { kind: 'edit'; id: SupplierId } | { kind: 'add' };

/** How many beans name each supplier, archived ones too. */
const countsOf = (beans: readonly Bean[]): ReadonlyMap<SupplierId, number> => {
  const counts = new Map<SupplierId, number>();
  for (const { supplierId } of beans) {
    if (supplierId !== null) counts.set(supplierId, (counts.get(supplierId) ?? 0) + 1);
  }
  return counts;
};

/** A row's quieter line: its beans, then its site ("3 beans · falcon.coffee"). */
const detailOf = (supplier: Supplier, beans: number): string =>
  [beanCount(beans), supplier.website ? siteOf(supplier.website) : ''].filter(Boolean).join(' · ');

/**
 * Suppliers, from the Beans list's "⋯" (docs/spec/beans-favourites-ghost.md, Suppliers): every
 * supplier with how many beans name it; one opens to change its details, or to delete it while no
 * bean names it. From a bean's supplier card it opens on that supplier.
 */
export function SuppliersDialog({
  open,
  onClose,
  start,
}: {
  open: boolean;
  onClose: () => void;
  /** Opens on this supplier's details, from a bean; done there, it closes back to the bean. */
  start?: SupplierId | undefined;
}) {
  const suppliers = useBeans((s) => s.suppliers);
  const beans = useBeans((s) => s.beans);
  const first: Page = start === undefined ? { kind: 'list' } : { kind: 'edit', id: start };
  const [page, setPage] = useState<Page>(first);
  const counts = countsOf(beans);
  const opened = page.kind === 'edit' ? suppliers.find((s) => s.id === page.id) : undefined;
  const back = () => {
    setPage({ kind: 'list' });
  };
  const close = () => {
    onClose();
    setPage(first);
  };
  // Opened on a supplier from its bean: Save or Cancel goes back to the bean, not the list.
  const done = start !== undefined && page.kind === 'edit' && page.id === start ? close : back;
  const onForm = page.kind === 'add' || opened !== undefined;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={opened?.name ?? (page.kind === 'add' ? 'Add supplier' : 'Suppliers')}
      description={
        onForm ? undefined : 'Picked on each bean · their website and contacts kept here once'
      }
    >
      {onForm ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            // The icon lines up with the fields' edge.
            className="-mt-2 -ml-3 self-start px-3"
            icon={<ChevronLeft aria-hidden="true" />}
            onClick={back}
          >
            Suppliers
          </Button>
          <SupplierForm
            key={opened?.id ?? 'new'}
            supplier={opened}
            beans={opened ? (counts.get(opened.id) ?? 0) : 0}
            onDone={done}
          />
        </>
      ) : (
        <>
          {suppliers.length === 0 ? (
            <p className="text-body text-ink-muted">
              No suppliers yet · add one here, or on a bean's Supplier
            </p>
          ) : (
            <ul aria-label="Suppliers" className="-mx-2 flex flex-col gap-0.5">
              {suppliers.map((supplier) => (
                <li key={supplier.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPage({ kind: 'edit', id: supplier.id });
                    }}
                    className="flex min-h-control-sm w-full flex-col justify-center rounded-md px-2 py-1.5 text-left hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="truncate text-body text-ink">{supplier.name}</span>
                    <span className="truncate text-label text-ink-muted">
                      {detailOf(supplier, counts.get(supplier.id) ?? 0)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="ghost"
            // px-2 like the rows above, so the icon lines up with their names.
            className="-ml-2 self-start px-2"
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              setPage({ kind: 'add' });
            }}
          >
            Add supplier
          </Button>
        </>
      )}
    </Dialog>
  );
}
