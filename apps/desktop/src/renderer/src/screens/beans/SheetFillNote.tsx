import { Button } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import type { SpecSheetFill } from './use-spec-sheet-fill';

/** What the offered supplier comes with: "its website and email". */
function withWhat({ website, email, phone }: { website: unknown; email: unknown; phone: unknown }) {
  const parts = [website ? 'website' : '', email ? 'email' : '', phone ? 'phone' : ''].filter(
    Boolean,
  );
  if (parts.length === 0) return '';
  const last = parts.pop() ?? '';
  return ` with its ${parts.length > 0 ? `${parts.join(', ')} and ${last}` : last}`;
}

/**
 * The line after Fill from spec sheet, and the offer to add a supplier the sheet named that you
 * don't have, with the website and contacts it gave (docs/spec/beans-favourites-ghost.md,
 * Suppliers). Not taken, Save still adds it, by name only.
 */
export function SheetFillNote({ fill }: { fill: SpecSheetFill }) {
  const { api } = useDeps();
  const run = useRun();
  const [problem, setProblem] = useState<string>();
  const offer = fill.supplierOffer;
  if (!fill.filled && !offer && !fill.added) return null;
  return (
    <div role="status" className="flex flex-col gap-1.5 text-label text-ink-muted">
      {fill.filled ? <p>{fill.filled}</p> : null}
      {offer ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p>
            New supplier {offer.name}
            {withWhat(offer)} from the sheet
          </p>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              setProblem(undefined);
              run(
                'beans.sheet-supplier-failed',
                async () => {
                  const done = await api.addSupplier(offer);
                  // Added meanwhile, from a bean or the Suppliers dialog: it is yours already.
                  if (done.ok || done.error.kind === 'name-taken') fill.supplierAdded();
                  else setProblem("Couldn't add the supplier · see Logs");
                },
                { failed: "Couldn't add the supplier · try again" },
              );
            }}
          >
            Add supplier
          </Button>
        </div>
      ) : null}
      {fill.added ? <p>{fill.added}</p> : null}
      {problem ? <p className="text-critical-text">{problem}</p> : null}
    </div>
  );
}
