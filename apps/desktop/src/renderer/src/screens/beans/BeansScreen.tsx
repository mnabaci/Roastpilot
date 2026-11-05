import type { BeanId } from '@roastpilot/shared';
import { Badge, Button } from '@roastpilot/ui';
import { useState } from 'react';
import { useBeans } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { BatchCalculator } from './BatchCalculator';
import { formatGrams } from './batch-format';
import { BeanDetail } from './BeanDetail';
import { BeanEditor } from './BeanEditor';

type RightSide = { kind: 'bean' } | { kind: 'add' } | { kind: 'calculator' };

const NAV_ROW = (current: boolean) =>
  current
    ? 'h-auto justify-start bg-surface-raised py-2 text-left text-ink'
    : 'h-auto justify-start py-2 text-left text-ink-muted hover:text-ink';

/** Beans on the left, one open on the right; only the right side scrolls (docs/spec/ui.md). */
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
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <nav
        aria-label="Beans"
        className="flex w-60 shrink-0 flex-col gap-1 overflow-y-auto py-6 pl-6"
      >
        <h1 className="pb-2 text-title">Beans</h1>
        {shown.map((bean) => {
          const current = right.kind === 'bean' && open?.id === bean.id;
          return (
            <Button
              key={bean.id}
              variant="ghost"
              title={bean.name}
              aria-current={current ? 'true' : undefined}
              className={NAV_ROW(current)}
              onClick={() => {
                showBean(bean.id);
              }}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{bean.name}</span>
                <span className="truncate text-label font-normal text-ink-muted">
                  {bean.origin} · {bean.process} · {formatGrams(bean.greenG)}
                </span>
              </span>
              {bean.greenG < bean.lowStockG && !bean.archived ? (
                <Badge tone="heat">Low</Badge>
              ) : null}
            </Button>
          );
        })}
        <Button
          className="mt-2 justify-start"
          onClick={() => {
            setRight({ kind: 'add' });
          }}
        >
          Add bean
        </Button>
        <Button
          variant="ghost"
          aria-current={right.kind === 'calculator' ? 'true' : undefined}
          className={NAV_ROW(right.kind === 'calculator')}
          onClick={() => {
            setRight({ kind: 'calculator' });
          }}
        >
          Batch calculator
        </Button>
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
      </nav>
      {/* Only this side scrolls. Relative, so screen-reader-only labels scroll with it. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
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
      </div>
    </main>
  );
}
