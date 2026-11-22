import {
  supplierNamed,
  type Bean,
  type BeanProcess,
  type BeanSpecies,
  type Supplier,
} from '@roastpilot/shared';
import {
  Button,
  NumberField,
  ReadValue,
  SegmentedControl,
  SelectField,
  TextField,
} from '@roastpilot/ui';
import { ExternalLink } from 'lucide-react';
import { useId } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useBeans } from '../../stores/use-stores';
import { siteOf, tastingNotes } from './bean-detail';
import { contactsOf } from './supplier-options';
import { SupplierField } from './SupplierField';
import type { BeanDraftState } from './use-bean-draft';

const PROCESSES: readonly { value: BeanProcess; label: string }[] = [
  { value: 'washed', label: 'Washed' },
  { value: 'natural', label: 'Natural' },
  { value: 'honey', label: 'Honey' },
  { value: 'other', label: 'Other' },
];

const SPECIES: readonly { value: BeanSpecies | ''; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'arabica', label: 'Arabica' },
  { value: 'robusta', label: 'Robusta' },
  { value: 'liberica', label: 'Liberica' },
  { value: 'excelsa', label: 'Excelsa' },
  { value: 'other', label: 'Other' },
];

type NumberKey = 'densityGL' | 'altitudeM' | 'moisturePct' | 'screen' | 'lowStockG';
type TextKey = 'origin' | 'variety' | 'link' | 'notes';

const NUMBER_CELLS: Readonly<Record<NumberKey, { label: string; unit?: string }>> = {
  altitudeM: { label: 'Altitude', unit: 'm' },
  screen: { label: 'Screen size' },
  densityGL: { label: 'Density', unit: 'g/L' },
  moisturePct: { label: 'Moisture', unit: '%' },
  lowStockG: { label: 'Low stock below', unit: 'g' },
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The Supplier tile: its name, a link to its website when it has one (main opens the saved
 * address), and how to reach it under it, else the order link's site.
 */
function SupplierTile({
  name,
  supplier,
  site,
  onOpenWebsite,
}: {
  name: string;
  supplier: Supplier | undefined;
  site: string;
  onOpenWebsite: (supplier: Supplier) => void;
}) {
  const id = useId();
  const contacts = supplier ? contactsOf(supplier) : '';
  const under = contacts !== '' ? contacts : name ? site : '';
  return (
    // Two columns: a supplier's name and its email run longer than a number.
    <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
      <span id={id} className="text-label text-ink-muted">
        Supplier
      </span>
      <p aria-labelledby={id} className="flex min-h-6 min-w-0 items-center text-body text-ink">
        {supplier?.website ? (
          <button
            type="button"
            aria-label={`Open ${supplier.name}'s website`}
            title={siteOf(supplier.website)}
            onClick={() => {
              onOpenWebsite(supplier);
            }}
            className="inline-flex min-w-0 items-center gap-1 rounded-sm text-left underline decoration-border-strong underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="truncate">{supplier.name}</span>
            <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
          </button>
        ) : (
          <span className="truncate">{name || site}</span>
        )}
      </p>
      {under ? (
        <p className="truncate text-label text-ink-muted" title={under}>
          {under}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Read, a bean's record as compact tiles (docs/spec/ui.md, Beans screen): as many columns as the
 * card holds (3 to 6), only the values it has, the supplier linking to its website with how to
 * reach it under it, and tasting notes as chips.
 */
function BeanTiles({
  draft,
  supplier,
  onOpenWebsite,
}: {
  draft: BeanDraftState['draft'];
  supplier: Supplier | undefined;
  onOpenWebsite: (supplier: Supplier) => void;
}) {
  const t = (v: string) => v.trim();
  const site = t(draft.link) ? siteOf(t(draft.link)) : '';
  const tiles: { label: string; value: string; under?: string }[] = [
    { label: 'Origin', value: t(draft.origin) },
    { label: 'Variety', value: t(draft.variety) },
    { label: 'Species', value: draft.species ? capital(draft.species) : '' },
    { label: 'Process', value: capital(draft.process) },
    { label: 'Altitude', value: t(draft.altitudeM) && `${t(draft.altitudeM)} m` },
    { label: 'Screen size', value: t(draft.screen) },
    { label: 'Density', value: t(draft.densityGL) && `${t(draft.densityGL)} g/L` },
    { label: 'Moisture', value: t(draft.moisturePct) && `${t(draft.moisturePct)} %` },
    { label: 'Decaf', value: draft.decaf ? 'Yes' : '' },
    { label: 'Low stock below', value: t(draft.lowStockG) && `${t(draft.lowStockG)} g` },
  ];
  const notes = tastingNotes(draft.notes);
  return (
    <div className="@container flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 @3xl:grid-cols-4 @5xl:grid-cols-6">
        {tiles
          .filter((tile) => tile.value !== '')
          .map(({ label, value, under }) => (
            <div key={label} className="min-w-0">
              <ReadValue label={label} value={value} numeric />
              {under ? <p className="truncate text-label text-ink-muted">{under}</p> : null}
            </div>
          ))}
        {t(draft.supplier) || site ? (
          <SupplierTile
            name={supplier?.name ?? t(draft.supplier)}
            supplier={supplier}
            site={site}
            onOpenWebsite={onOpenWebsite}
          />
        ) : null}
      </div>
      {t(draft.notes) ? (
        notes.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-label text-ink-muted">Notes</p>
            <ul aria-label="Notes" className="flex flex-wrap gap-2">
              {notes.map((note) => (
                <li
                  key={note}
                  className="rounded-full bg-surface-hover px-3 py-1 text-label text-ink"
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ReadValue label="Notes" value={t(draft.notes)} />
        )
      ) : null}
    </div>
  );
}

/**
 * A bean's record as one grid of fields in Edit (docs/spec/ui.md, Read and edit), and as tiles
 * while reading. Its name is the page's title, not a cell here.
 */
export function BeanFields({
  bean,
  state,
  readOnly,
}: {
  bean: Bean | undefined;
  state: BeanDraftState;
  readOnly: boolean;
}) {
  const { api } = useDeps();
  const run = useRun();
  const { draft, change, errors, setProblem } = state;
  const textCell = (key: TextKey, label: string, className: string) => (
    <div className={`flex flex-col gap-1 ${className}`}>
      <TextField
        label={label}
        value={draft[key]}
        onChange={(value) => {
          change({ [key]: value });
        }}
      />
      {errors[key] ? <p className="text-label text-critical-text">{errors[key]}</p> : null}
    </div>
  );
  const numberCell = (key: NumberKey) => {
    const { label, unit } = NUMBER_CELLS[key];
    return (
      <NumberField
        label={label}
        {...(unit ? { unit } : {})}
        value={draft[key]}
        invalid={errors[key] !== undefined}
        hint={errors[key]}
        onChange={(value) => {
          change({ [key]: value });
        }}
      />
    );
  };
  const suppliers = useBeans((s) => s.suppliers);
  const savedLink = bean?.link != null && draft.link.trim() === bean.link;
  // Main opens the website saved with the supplier; the screen only names the supplier.
  const openWebsite = (supplier: Supplier) => {
    run(
      'beans.supplier-website-failed',
      async () => {
        const opened = await api.openSupplierWebsite(supplier.id);
        if (!opened.ok) setProblem(`Couldn't open ${supplier.name}'s website · see Logs`);
      },
      { failed: "Couldn't open the website · try again" },
    );
  };
  if (readOnly) {
    return (
      <BeanTiles
        draft={draft}
        supplier={supplierNamed(suppliers, draft.supplier)}
        onOpenWebsite={openWebsite}
      />
    );
  }
  return (
    // Five columns: the ten short values in two rows, then the shop and its link, then notes.
    <div className="grid grid-cols-5 items-start gap-x-3 gap-y-4">
      {textCell('origin', 'Origin', '')}
      {textCell('variety', 'Variety', '')}
      <SelectField
        label="Species"
        value={draft.species}
        options={SPECIES}
        onChange={(species) => {
          change({ species });
        }}
      />
      <SelectField
        label="Process"
        value={draft.process}
        options={PROCESSES}
        onChange={(process) => {
          change({ process });
        }}
      />
      <div className="flex flex-col gap-1.5">
        <p className="text-label text-ink-muted">Decaf</p>
        <SegmentedControl
          label="Decaf"
          fill
          options={[
            { value: false, label: 'No' },
            { value: true, label: 'Yes' },
          ]}
          value={draft.decaf}
          onChange={(decaf) => {
            change({ decaf });
          }}
        />
      </div>
      {numberCell('altitudeM')}
      {numberCell('screen')}
      {numberCell('densityGL')}
      {numberCell('moisturePct')}
      {numberCell('lowStockG')}
      <p className="col-span-5 -mt-2 text-label text-ink-muted">
        Density is the one to measure: weigh a fixed volume of green beans.
      </p>
      <SupplierField
        className="col-span-2"
        value={draft.supplier}
        error={errors.supplier}
        onChange={(supplier) => {
          change({ supplier });
        }}
      />
      {/* Where to order it again: the button opens the saved link (main opens only a saved one). */}
      <div className="col-span-3 flex items-end gap-2">
        {textCell('link', 'Order link', 'min-w-0 flex-1')}
        <Button
          size="sm"
          variant="ghost"
          aria-label="Open the order link"
          disabled={!savedLink}
          icon={<ExternalLink aria-hidden="true" />}
          onClick={() => {
            if (!bean) return;
            run(
              'beans.open-link-failed',
              async () => {
                const opened = await api.openBeanLink(bean.id);
                if (!opened.ok) setProblem("Couldn't open the order link · see Logs");
              },
              { failed: "Couldn't open the order link · try again" },
            );
          }}
        />
      </div>
      {textCell('notes', 'Notes', 'col-span-5')}
    </div>
  );
}
