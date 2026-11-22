import { supplierNamed, type SpecSheetFields, type SupplierFields } from '@roastpilot/shared';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { aiReadMessage } from '../../features/ai-messages';
import { useAiHelpers } from '../../features/use-ai-providers';
import { useRun } from '../../features/use-run';
import { useBeans } from '../../stores/use-stores';
import { fillFromSheet } from './bean-draft';
import type { BeanDraftState } from './use-bean-draft';

/** A supplier a sheet named that you don't have yet, with how to reach it, as the sheet gave. */
export type SupplierOffer = SupplierFields;

/** Where a fill came from, as its lines say it. */
type FillSource = 'sheet' | 'page';
const FROM: Readonly<Record<FillSource, string>> = { sheet: 'the sheet', page: 'the order page' };

/**
 * Fill details on a bean in Edit, or on Add bean (docs/spec/beans-favourites-ghost.md): whether
 * it is offered (the AI helpers on with a key for a provider that reads sheets), the spec-sheet
 * dialog, reading the order page, and one line after either saying how many fields it filled. A
 * supplier it names that you don't have is offered with the website and contacts it gave
 * (Suppliers).
 */
export function useSpecSheetFill(record: BeanDraftState, { isNew }: { isNew: boolean }) {
  const { api } = useDeps();
  const run = useRun();
  const { sheets } = useAiHelpers();
  const suppliers = useBeans((s) => s.suppliers);
  const [open, setOpen] = useState(false);
  const [readingPage, setReadingPage] = useState(false);
  const [source, setSource] = useState<FillSource>('sheet');
  const [problem, setProblem] = useState<string>();
  const [filled, setFilled] = useState<string>();
  const [offer, setOffer] = useState<SupplierOffer>();
  const [added, setAdded] = useState<string>();
  const forget = () => {
    setProblem(undefined);
    setFilled(undefined);
    setOffer(undefined);
    setAdded(undefined);
  };
  const onFilled = (fields: SpecSheetFields, from: FillSource = 'sheet') => {
    const { cells, count } = fillFromSheet(record.draft, fields, { isNew, suppliers });
    if (count > 0) record.change(cells);
    setSource(from);
    setFilled(
      count === 0
        ? `Nothing new from ${FROM[from]} · your fields are already filled`
        : `Filled ${String(count)} ${count === 1 ? 'field' : 'fields'} from ${FROM[from]} · check them, then Save`,
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
    onFilled,
    /** The bean's order page, fetched and read in main; its line or its problem after. */
    fromPage: (url: string) => {
      if (readingPage) return;
      forget();
      setReadingPage(true);
      run(
        'beans.page-read-failed',
        async () => {
          try {
            const answer = await api.readSpecSheet({ kind: 'page', url });
            if (!answer.ok) {
              setProblem(aiReadMessage(answer.error, 'fields'));
              return;
            }
            if (answer.value.status !== 'read') return;
            if (Object.keys(answer.value.fields).length === 0) {
              setProblem('Nothing to fill from that page · use a spec sheet instead');
              return;
            }
            onFilled(answer.value.fields, 'page');
          } finally {
            setReadingPage(false);
          }
        },
        { failed: "Couldn't read the order page · try again" },
      );
    },
    /** While the order page is read: Fill details waits. */
    readingPage,
    /** Why the order page wasn't read, until the next fill or Save. */
    problem,
    /** Where the last fill came from, for the supplier offer's line. */
    source: FROM[source],
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
