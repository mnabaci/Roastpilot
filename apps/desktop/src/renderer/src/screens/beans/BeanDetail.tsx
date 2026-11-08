import { beanHints } from '@roastpilot/core';
import type { Bean, RoastSummary } from '@roastpilot/shared';
import { Badge, Button, Menu, formatNumber, StatCard } from '@roastpilot/ui';
import { useState } from 'react';
import { describePlan } from './batch-format';
import { BeanEditor } from './BeanEditor';
import { BeanFacts } from './BeanFacts';
import { BeanRoasts } from './BeanRoasts';
import { AddStockForm, AdjustStockForm } from './StockForms';
import { useLibraryFiles } from '../../features/use-library-files';
import { useBeanActions } from './use-bean-actions';

type Panel = 'none' | 'edit' | 'add-stock' | 'adjust-stock';

/** One bean: its record, stock, roasts and what you can do with it (docs/spec/ui.md, Beans screen). */
export function BeanDetail({
  bean,
  beans,
  roasts,
  onRoast,
  onOpenProfile,
}: {
  bean: Bean;
  beans: readonly Bean[];
  roasts: readonly RoastSummary[];
  onRoast: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const [panel, setPanel] = useState<Panel>('none');
  const actions = useBeanActions({ bean, beans, roasts, onRoast, onOpenProfile });
  const files = useLibraryFiles('beans');
  const close = () => {
    setPanel('none');
  };

  if (panel === 'edit') return <BeanEditor bean={bean} onDone={close} onAdded={close} />;

  const low = bean.greenG < bean.lowStockG;
  return (
    <section aria-label={bean.name} className="flex flex-col gap-5">
      {/* Everything for this bean in one row: the two you use most, the rest behind ⋯. */}
      <header className="flex min-h-control-sm flex-wrap items-center gap-3">
        <h2 className="min-w-0 truncate text-title">{bean.name}</h2>
        {low ? <Badge tone="heat">Low stock</Badge> : null}
        {bean.archived ? <Badge>Archived</Badge> : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            // One primary at a time: an open form has its own.
            variant={panel === 'none' ? 'primary' : 'secondary'}
            size="sm"
            disabled={actions.roastBlocked}
            onClick={actions.roastThis}
          >
            Roast this bean
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setPanel('add-stock');
            }}
          >
            Add stock
          </Button>
          <Menu
            label={`More for ${bean.name}`}
            items={[
              {
                label: 'Adjust stock',
                onSelect: () => {
                  setPanel('adjust-stock');
                },
              },
              {
                label: 'Edit',
                onSelect: () => {
                  setPanel('edit');
                },
              },
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
        </div>
      </header>
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Green"
          value={formatNumber(bean.greenG, 0)}
          unit="g"
          context={bean.batchPlan ? describePlan(bean.batchPlan) : 'No batch plan'}
        />
        <StatCard label="Roasted" value={formatNumber(bean.roastedG, 0)} unit="g" />
        <StatCard
          label="Weight loss"
          value={formatNumber(bean.avgLossPct, 1)}
          unit="%"
          context={bean.avgLossPct === null ? 'Assumes 15% for now' : 'Average of its roasts'}
        />
      </div>
      {actions.problem ? (
        <p role="alert" className="text-label text-critical-text">
          {actions.problem}
        </p>
      ) : null}
      {panel === 'add-stock' ? <AddStockForm bean={bean} onDone={close} /> : null}
      {panel === 'adjust-stock' ? <AdjustStockForm bean={bean} onDone={close} /> : null}
      <BeanFacts bean={bean} />
      <div className="flex flex-col gap-1">
        {beanHints(bean).map((hint) => (
          <p key={hint} className="text-label text-ink-muted">
            {hint}
          </p>
        ))}
      </div>
      <BeanRoasts bean={bean} roasts={roasts} />
    </section>
  );
}
