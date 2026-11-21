import type { Bean, RoastSummary } from '@roastpilot/shared';
import { Badge, Button, cn, Menu, formatNumber, StatCard } from '@roastpilot/ui';
import { ExternalLink } from 'lucide-react';
import { FillFromSheetButton } from './FillFromSheetButton';
import { SpecSheetDialog } from './SpecSheetDialog';
import { useSpecSheetFill } from './use-spec-sheet-fill';
import { useState } from 'react';
import { planLine } from './batch-format';
import { beanPlan } from './bean-plan';
import { usePlanContext } from './use-plan-context';
import { BeanAbout } from './BeanAbout';
import { useBeanDraft } from './use-bean-draft';
import { RecordHeader } from '../../features/RecordHeader';
import { useRecordCards } from '../../features/use-record-cards';
import { PAGE_WIDTH } from '../../lib/page-width';
import { BeanRoasts } from './BeanRoasts';
import { StockHistory } from './StockHistory';
import { AdjustStockDialog } from './AdjustStockDialog';
import { useLibraryFiles } from '../../features/use-library-files';
import { useBeanActions } from './use-bean-actions';

type Panel = 'none' | 'adjust-stock';

/**
 * One bean: its record, stock, roasts and what you can do with it (docs/spec/ui.md, Beans screen).
 * Edit works in place, as on Profiles and Roasters: the same cards, the record's values as fields.
 */
export function BeanDetail({
  bean,
  beans,
  roasts,
  onRoast,
  onOpenProfile,
  onOpenRoast,
}: {
  bean: Bean;
  beans: readonly Bean[];
  roasts: readonly RoastSummary[];
  onRoast: () => void;
  onOpenProfile: (id: string) => void;
  onOpenRoast?: ((id: number) => void) | undefined;
}) {
  const [panel, setPanel] = useState<Panel>('none');
  const planContext = usePlanContext();
  const actions = useBeanActions({ bean, beans, roasts, onRoast, onOpenProfile });
  const files = useLibraryFiles('beans');
  const close = () => {
    setPanel('none');
  };
  const record = useBeanDraft(bean);
  const fill = useSpecSheetFill(record, { isNew: false });
  // An unsaved edit kept from before opens in Edit, so it shows (as on Profiles and Roasters).
  const [editing, setEditing] = useState(record.edited);
  const cards = useRecordCards(editing, ['bean.about']);

  const low = bean.greenG < bean.lowStockG;
  return (
    <section aria-label={bean.name} className={cn('flex flex-col gap-4', PAGE_WIDTH)}>
      <RecordHeader
        name={bean.name}
        editing={editing}
        badges={
          low || bean.archived ? (
            <>
              {low ? <Badge tone="heat">Low stock</Badge> : null}
              {bean.archived ? <Badge>Archived</Badge> : null}
            </>
          ) : undefined
        }
        edit={{
          name: record.draft.name,
          onName: (name) => {
            record.change({ name });
          },
          nameError: record.errors.name,
          edited: record.edited,
          onCancel: () => {
            record.cancel();
            fill.forget();
            setEditing(false);
          },
          onSave: () => {
            record.save(() => {
              fill.forget();
              setEditing(false);
            });
          },
          canSave: record.canSave,
          lead: fill.offered ? <FillFromSheetButton onClick={fill.show} /> : undefined,
        }}
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              disabled={actions.roastBlocked}
              onClick={actions.roastThis}
            >
              Roast this bean
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPanel('adjust-stock');
              }}
            >
              Adjust stock
            </Button>
            {bean.link === null ? null : (
              <Button
                variant="ghost"
                size="sm"
                icon={<ExternalLink />}
                onClick={actions.orderAgain}
              >
                Order again
              </Button>
            )}
            {/* Edit sits in the same place on every page that has one (docs/spec/ui.md). */}
            <Button
              size="sm"
              onClick={() => {
                setEditing(true);
              }}
            >
              Edit
            </Button>
            <Menu
              label={`More for ${bean.name}`}
              items={[
                {
                  label: bean.profileId === null ? 'Make a profile' : 'Make another profile',
                  disabled: !actions.canMakeProfile,
                  onSelect: actions.makeProfile,
                },
                {
                  label: 'Export this bean',
                  onSelect: () => {
                    files.exportFile({ kind: 'beans', ids: [bean.id] });
                  },
                },
                { label: bean.archived ? 'Bring back' : 'Archive', onSelect: actions.archive },
              ]}
            />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Green"
          value={formatNumber(bean.greenG, 0)}
          unit="g"
          // Worked out live for the active roaster (docs/spec/batch-and-stock.md).
          context={
            planContext
              ? planLine(beanPlan(bean, planContext).batchesG, planContext.roaster.batchMinG)
              : 'Add a roaster to plan its batches'
          }
        />
        <StatCard
          label="Weight loss"
          value={formatNumber(bean.avgLossPct, 1)}
          unit="%"
          context={bean.avgLossPct === null ? 'Assumes 15% for now' : 'Average of its roasts'}
        />
      </div>
      {record.problem ? (
        <p role="alert" className="text-label text-critical-text">
          {record.problem}
        </p>
      ) : null}
      {editing && fill.filled ? (
        <p role="status" className="text-label text-ink-muted">
          {fill.filled}
        </p>
      ) : null}
      <SpecSheetDialog open={fill.open} onClose={fill.close} onFilled={fill.onFilled} />
      {actions.problem ? (
        <p role="alert" className="text-label text-critical-text">
          {actions.problem}
        </p>
      ) : null}
      <AdjustStockDialog bean={bean} open={panel === 'adjust-stock'} onClose={close} />
      <StockHistory bean={bean} />
      <BeanAbout
        bean={bean}
        state={record}
        editing={editing}
        open={cards.isOpen('bean.about', editing && Object.keys(record.errors).length > 0)}
        onOpenChange={(open) => {
          cards.setOpen('bean.about', open);
        }}
      />
      <BeanRoasts bean={bean} roasts={roasts} onOpen={onOpenRoast} />
    </section>
  );
}
