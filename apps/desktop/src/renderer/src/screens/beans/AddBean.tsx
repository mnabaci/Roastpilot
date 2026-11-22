import type { BeanId } from '@roastpilot/shared';
import { cn } from '@roastpilot/ui';
import { RecordHeader } from '../../features/RecordHeader';
import { PAGE_WIDTH } from '../../lib/page-width';
import { BeanAbout } from './BeanAbout';
import { FillFromSheetButton } from './FillFromSheetButton';
import { SheetFillNote } from './SheetFillNote';
import { SpecSheetDialog } from './SpecSheetDialog';
import { useSpecSheetFill } from './use-spec-sheet-fill';
import { useBeanDraft } from './use-bean-draft';

/**
 * A new bean (docs/spec/beans-favourites-ghost.md, Beans): the bean page in Edit from the start,
 * its title the name's field and its record the About card's fields; Add bean saves it.
 */
export function AddBean({
  onCancel,
  onAdded,
}: {
  onCancel: () => void;
  onAdded: (id: BeanId) => void;
}) {
  const record = useBeanDraft(undefined);
  const fill = useSpecSheetFill(record, { isNew: true });
  return (
    <section aria-label="Add bean" className={cn('flex flex-col gap-4', PAGE_WIDTH)}>
      <RecordHeader
        name=""
        editing
        edit={{
          name: record.draft.name,
          onName: (name) => {
            record.change({ name });
          },
          nameError: record.errors.name,
          // A new bean is all unsaved: no badge for it.
          edited: false,
          onCancel: () => {
            record.cancel();
            onCancel();
          },
          onSave: () => {
            record.save(onAdded);
          },
          canSave: record.canSave,
          saveLabel: 'Add bean',
          placeholder: 'Name this bean',
          lead: fill.offered ? <FillFromSheetButton onClick={fill.show} /> : undefined,
        }}
        actions={null}
      />
      {record.problem ? (
        <p role="alert" className="text-label text-critical-text">
          {record.problem}
        </p>
      ) : null}
      <SheetFillNote fill={fill} />
      <SpecSheetDialog open={fill.open} onClose={fill.close} onFilled={fill.onFilled} />
      {/* Always open while adding: there's nothing to fold it to yet. */}
      <BeanAbout bean={undefined} state={record} editing open onOpenChange={() => undefined} />
    </section>
  );
}
