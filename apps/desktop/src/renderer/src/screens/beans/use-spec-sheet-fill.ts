import { supplierNamed, type SpecSheetFields, type SupplierFields } from '@roastpilot/shared';
import { useState } from 'react';
import { useAiHelpers } from '../../features/use-ai-providers';
import { useBeans } from '../../stores/use-stores';
import { fillFromSheet } from './bean-draft';
import type { BeanDraftState } from './use-bean-draft';

/** A supplier a sheet named that you don't have yet, with how to reach it, as the sheet gave. */
export type SupplierOffer = SupplierFields;

/**
 * Fill from spec sheet on a bean in Edit, or on Add bean: whether it is offered (the AI helpers
 * on with a key for a provider that reads sheets), the dialog, and one line after it saying how
 * many fields it filled. A supplier the sheet names that you don't have is offered with the
 * website and contacts the sheet gave (docs/spec/beans-favourites-ghost.md, Suppliers).
 */
export function useSpecSheetFill(record: BeanDraftState, { isNew }: { isNew: boolean }) {
  const { sheets } = useAiHelpers();
  const suppliers = useBeans((s) => s.suppliers);
  const [open, setOpen] = useState(false);
  const [filled, setFilled] = useState<string>();
  const [offer, setOffer] = useState<SupplierOffer>();
  const [added, setAdded] = useState<string>();
  const forget = () => {
    setFilled(undefined);
    setOffer(undefined);
    setAdded(undefined);
  };
  return {
    offered: sheets,
    open,
    show: () => {
      forget();
      setOpen(true);
    },
    close: () => {
      setOpen(false);
    },
    onFilled: (fields: SpecSheetFields) => {
      const { cells, count } = fillFromSheet(record.draft, fields, { isNew, suppliers });
      if (count > 0) record.change(cells);
      setFilled(
        count === 0
          ? 'Nothing new from that sheet · your fields are already filled'
          : `Filled ${String(count)} ${count === 1 ? 'field' : 'fields'} from the sheet · check them, then Save`,
      );
      setAdded(undefined);
      const name = cells.supplier;
      setOffer(
        name && !supplierNamed(suppliers, name)
          ? {
              name,
              website: fields.supplierWebsite ?? null,
              email: fields.supplierEmail ?? null,
              phone: fields.supplierPhone ?? null,
              notes: null,
            }
          : undefined,
      );
    },
    /** The line after a fill, until the next one or Save. */
    filled,
    /** The new supplier the sheet named, until it is added, the next fill or Save. */
    supplierOffer: offer,
    /** The offered supplier is yours now: the offer gives way to a line saying so. */
    supplierAdded: () => {
      if (offer) setAdded(`Added ${offer.name} to your suppliers`);
      setOffer(undefined);
    },
    /** The line after the offer was taken, until the next fill or Save. */
    added,
    forget,
  };
}

export type SpecSheetFill = ReturnType<typeof useSpecSheetFill>;
