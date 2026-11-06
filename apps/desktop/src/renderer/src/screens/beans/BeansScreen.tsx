import type { BeanId } from '@roastpilot/shared';
import { Badge, Button, NavList, SidebarLayout } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useBeans } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { BatchCalculator } from './BatchCalculator';
import { formatGrams } from './batch-format';
import { BeanDetail } from './BeanDetail';
import { BeanEditor } from './BeanEditor';

type RightSide = { kind: 'bean' } | { kind: 'add' } | { kind: 'calculator' };

/** Beans on the left, one open on the right, in the shared sidebar (docs/spec/ui.md). */
export function BeansScreen({
  onRoast,
  onOpenProfile,
}: {
  onRoast: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const beans = useBeans((s) => s.beans);
  const roasts = useRoastList() ?? [];
  const [pickedId, setPickedId] = useState<BeanId>();
  const [right, setRight] = useState<RightSide>({ kind: 'bean' });
  const [showArchived, setShowArchived] = useState(false);
  const [orderG, setOrderG] = useState('');
  const shown = beans.filter((b) => showArchived || !b.archived);
  const open = beans.find((b) => b.id === pickedId) ?? shown[0];
  const hasArchived = beans.some((b) => b.archived);
  const showBean = (id: BeanId) => {
    setPickedId(id);
    setRight({ kind: 'bean' });
  };
  return (
    <SidebarLayout
      title="Beans"
      contentLabel={right.kind === 'calculator' ? 'Batch calculator' : 'Bean'}
      sidebar={
        <>
          <NavList
            label="Beans"
            items={shown.map((bean) => ({
              id: bean.id,
              label: bean.name,
              detail: `${formatGrams(bean.greenG)} · ${bean.origin} · ${bean.process}`,
              badge:
                bean.greenG < bean.lowStockG && !bean.archived ? (
                  <Badge tone="heat">Low</Badge>
                ) : undefined,
            }))}
            openId={right.kind === 'bean' ? open?.id : undefined}
            onOpen={showBean}
          />
          <Button
            variant="ghost"
            className="justify-start"
            icon={<Plus aria-hidden="true" />}
            aria-current={right.kind === 'add' ? 'true' : undefined}
            onClick={() => {
              setRight({ kind: 'add' });
            }}
          >
            Add bean
          </Button>
          <NavList
            label="Tools"
            items={[{ id: 'calculator', label: 'Batch calculator' }]}
            openId={right.kind === 'calculator' ? 'calculator' : undefined}
            onOpen={() => {
              setRight({ kind: 'calculator' });
            }}
          />
          {hasArchived ? (
            <Button
              variant="ghost"
              aria-pressed={showArchived}
              className="justify-start text-ink-muted hover:text-ink"
              onClick={() => {
                setShowArchived(!showArchived);
              }}
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
          ) : null}
        </>
      }
    >
      {right.kind === 'add' ? (
        <BeanEditor
          bean={undefined}
          onDone={() => {
            setRight({ kind: 'bean' });
          }}
          onAdded={showBean}
        />
      ) : right.kind === 'calculator' ? (
        <section aria-label="Batch calculator" className="flex max-w-xl flex-col gap-4">
          <h2 className="text-heading">Batch calculator</h2>
          <BatchCalculator orderG={orderG} onOrderG={setOrderG} />
        </section>
      ) : open ? (
        <BeanDetail
          key={open.id}
          bean={open}
          beans={beans}
          roasts={roasts}
          onRoast={onRoast}
          onOpenProfile={onOpenProfile}
        />
      ) : (
        <p className="text-body text-ink-muted">
          No beans yet · add one to track its stock and find its best roast
        </p>
      )}
    </SidebarLayout>
  );
}
