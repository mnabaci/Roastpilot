import type { BeanId } from '@roastpilot/shared';
import { Badge, Button, cn, Menu, NavList, SidebarLayout } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useBeans } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { BatchCalculator } from './BatchCalculator';
import { beanDetail } from './bean-detail';
import { BeanDetail } from './BeanDetail';
import { BeanEditor } from './BeanEditor';
import { PAGE_WIDTH } from '../../lib/page-width';

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
      titleAction={
        <Menu
          label="More for Beans"
          items={[
            {
              label: 'Batch calculator',
              onSelect: () => {
                setRight({ kind: 'calculator' });
              },
            },
            ...(hasArchived
              ? [
                  {
                    label: showArchived ? 'Hide archived' : 'Show archived',
                    onSelect: () => {
                      setShowArchived(!showArchived);
                    },
                  },
                ]
              : []),
          ]}
        />
      }
      contentLabel={right.kind === 'calculator' ? 'Batch calculator' : 'Bean'}
      sidebar={
        <>
          <NavList
            label="Beans"
            items={shown.map((bean) => ({
              id: bean.id,
              label: bean.name,
              detail: beanDetail(bean),
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
        <section aria-label="Batch calculator" className={cn('flex flex-col gap-4', PAGE_WIDTH)}>
          <div className="flex min-h-control-sm min-w-0 items-center">
            <h2 className="truncate text-title">Batch calculator</h2>
          </div>
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
        <p className="flex min-h-control-sm items-center text-body text-ink-muted">
          No beans yet · add one to track its stock and find its best roast
        </p>
      )}
    </SidebarLayout>
  );
}
