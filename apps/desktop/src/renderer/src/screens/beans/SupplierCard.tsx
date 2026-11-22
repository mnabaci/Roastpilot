import type { Supplier } from '@roastpilot/shared';
import { Button, Popover, PopoverClose } from '@roastpilot/ui';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useRun } from '../../features/use-run';
import { useBeans } from '../../stores/use-stores';
import { siteOf } from './bean-detail';
import { suppliedLine } from './supplier-draft';

/** Copies one detail; a tick for a moment says it did, and screen readers hear "Copied". */
function CopyButton({ label, text }: { label: string; text: string }) {
  const run = useRun();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={`Copy ${label.toLowerCase()}`}
      title={`Copy ${label.toLowerCase()}`}
      onClick={() => {
        run(
          'beans.supplier-copy-failed',
          async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          },
          { failed: "Couldn't copy · try again" },
        );
      }}
      className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-focus"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-3.5 text-good" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
      <span role="status" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}

/**
 * One way to reach it: an icon for what it is, its value, and Copy at the row's end; the icon's
 * name for screen readers.
 */
function Contact({
  icon,
  label,
  copy,
  children,
}: {
  icon: ReactNode;
  label: string;
  /** What Copy puts on the clipboard: the whole address, where the row shows its site. */
  copy: string;
  children: ReactNode;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 text-body text-ink">
      <span aria-hidden="true" className="shrink-0 text-ink-muted [&_svg]:size-4">
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      {children}
      <CopyButton label={label} text={copy} />
    </li>
  );
}

/**
 * A bean's supplier at a glance, from its name on the bean (docs/spec/beans-favourites-ghost.md,
 * Suppliers): which beans it supplies, its website, email and phone, its notes, and one action,
 * Edit supplier (Add details while it has none).
 */
export function SupplierCard({
  supplier,
  under,
  onOpenWebsite,
  onEdit,
}: {
  supplier: Supplier;
  /** Its quiet line under the name: email · phone, else the order link's site. */
  under: string;
  onOpenWebsite: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
}) {
  const beans = useBeans((s) => s.beans);
  const supplied = beans.filter((b) => b.supplierId === supplier.id).map((b) => b.name);
  const { website, email, phone, notes } = supplier;
  const reachable = [website, email, phone].some(Boolean);
  const empty = !reachable && !notes;
  return (
    <Popover
      label={supplier.name}
      // As wide as InfoButton's panel: room for an email beside its Copy.
      className="w-96"
      trigger={
        <button
          type="button"
          // Names what opens, so the name alone doesn't sound like a link away.
          aria-label={`${supplier.name}, supplier details`}
          className="group flex min-w-0 flex-col items-start gap-0.5 self-start rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span className="flex min-h-6 max-w-full min-w-0 items-center gap-1 text-body text-ink">
            <span className="truncate underline decoration-border-strong underline-offset-4 group-hover:decoration-ink group-data-[state=open]:decoration-ink">
              {supplier.name}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-muted transition-transform group-data-[state=open]:rotate-180"
            />
          </span>
          {under ? (
            <span className="max-w-full truncate text-label text-ink-muted">{under}</span>
          ) : null}
        </button>
      }
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body font-semibold text-ink">{supplier.name}</p>
        <p className="text-label text-ink-muted">{suppliedLine(supplied)}</p>
      </div>
      {empty ? (
        <p className="border-t border-border pt-3 text-label text-ink-muted">
          No website, email or phone yet
        </p>
      ) : (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {reachable ? (
            <ul aria-label="Contacts" className="flex flex-col gap-2">
              {website ? (
                <Contact icon={<Globe />} label="Website" copy={website}>
                  <PopoverClose asChild>
                    <button
                      type="button"
                      title={website}
                      onClick={() => {
                        onOpenWebsite(supplier);
                      }}
                      className="inline-flex min-w-0 items-center gap-1 rounded-sm text-left underline decoration-border-strong underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <span className="truncate">{siteOf(website)}</span>
                      <ExternalLink
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-ink-muted"
                      />
                    </button>
                  </PopoverClose>
                </Contact>
              ) : null}
              {email ? (
                <Contact icon={<Mail />} label="Email" copy={email}>
                  <span className="truncate select-text" title={email}>
                    {email}
                  </span>
                </Contact>
              ) : null}
              {phone ? (
                <Contact icon={<Phone />} label="Phone" copy={phone}>
                  <span className="truncate tabular-nums select-text">{phone}</span>
                </Contact>
              ) : null}
            </ul>
          ) : null}
          {notes ? (
            <p className="line-clamp-4 text-label whitespace-pre-line text-ink-muted select-text">
              {notes}
            </p>
          ) : null}
        </div>
      )}
      <PopoverClose asChild>
        <Button
          size="sm"
          variant="ghost"
          // The icon lines up with the text above it.
          className="-ml-2 self-start px-2"
          icon={empty ? <Plus aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          onClick={() => {
            onEdit(supplier);
          }}
        >
          {empty ? 'Add details' : 'Edit supplier'}
        </Button>
      </PopoverClose>
    </Popover>
  );
}
