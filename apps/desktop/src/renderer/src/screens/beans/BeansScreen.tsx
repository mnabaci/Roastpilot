import type { BeanId } from '@roastpilot/shared';
import { Badge, Button, Dialog, Menu, NavList, SidebarLayout } from '@roastpilot/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { SelectionBar } from '../../features/SelectionBar';
import { useLibraryFiles } from '../../features/use-library-files';
import { useRun } from '../../features/use-run';
import { useSelection } from '../../features/use-selection';
import { useToast } from '../../features/use-toast';
import { useBeans } from '../../stores/use-stores';
import { useRoastList } from '../history/use-roast-list';
import { BatchCalculator } from './BatchCalculator';
import { beanDetail } from './bean-detail';
import { BeanDetail } from './BeanDetail';
import { BeanEditor } from './BeanEditor';

type RightSide = { kind: 'bean' } | { kind: 'add' };

/** Beans on the left, one open on the right, in the shared sidebar (docs/spec/ui.md). */
export function BeansScreen({
  onRoast,
  onOpenProfile,
  onOpenRoast,
}: {
  onRoast: () => void;
  onOpenProfile: (id: string) => void;
  /** Opens one of the bean's roasts in History. */
  onOpenRoast?: (id: number) => void;
}) {
  const { api } = useDeps();
  const run = useRun();
  const toast = useToast();
  const beans = useBeans((s) => s.beans);
  const roasts = useRoastList() ?? [];
  const [pickedId, setPickedId] = useState<BeanId>();
  const [right, setRight] = useState<RightSide>({ kind: 'bean' });
  const [showArchived, setShowArchived] = useState(false);
  // The calculator is a dialog over the list: a quick "what would this order make", then back.
  const [calculating, setCalculating] = useState(false);
  const [orderG, setOrderG] = useState('');
  const [calcBatchG, setCalcBatchG] = useState('');
  const shown = beans.filter((b) => showArchived || !b.archived);
  const open = beans.find((b) => b.id === pickedId) ?? shown[0];
  const hasArchived = beans.some((b) => b.archived);
  const showBean = (id: BeanId) => {
    setPickedId(id);
    setRight({ kind: 'bean' });
  };
  const files = useLibraryFiles('beans', (id) => {
    // An imported bean is never archived, so it shows in the list as it is.
    if (typeof id === 'number') showBean(id);
  });
  // Select mode: an archived bean can be exported but not archived again, so it isn't ticked.
  const selection = useSelection(
    shown.filter((b) => !b.archived).map((b) => b.id),
    beans.map((b) => b.id),
  );
  const archiveTicked = () => {
    const ids = [...selection.checked];
    run(
      'beans.archive-many-failed',
      async () => {
        let failed = 0;
        for (const id of ids) {
          const done = await api.setBeanArchived({ id, archived: true });
          if (!done.ok) failed += 1;
        }
        selection.done();
        if (failed > 0) toast('error', "Couldn't archive every bean · see Logs");
        else
          toast('success', `Archived ${String(ids.length)} ${ids.length === 1 ? 'bean' : 'beans'}`);
      },
      { failed: "Couldn't archive the beans · try again" },
    );
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
                setCalculating(true);
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
            {
              label: 'Export all',
              disabled: beans.length === 0,
              onSelect: () => {
                files.exportFile({ kind: 'beans' });
              },
            },
            { label: 'Import a Roastpilot file', onSelect: files.importFile },
            { label: 'Select', disabled: shown.length === 0, onSelect: selection.start },
          ]}
        />
      }
      contentLabel="Bean"
      sidebar={
        <>
          {selection.selecting ? (
            <SelectionBar
              label="Selected beans"
              count={selection.checked.size}
              exportAction={() => {
                files.exportFile({ kind: 'beans', ids: [...selection.checked] });
              }}
              remove={{
                verb: 'Archive',
                noun: ['bean', 'beans'],
                detail: 'Show archived brings them back',
                onConfirm: archiveTicked,
              }}
              onDone={selection.done}
            />
          ) : null}
          <NavList
            label="Beans"
            items={shown.map((bean) => ({
              id: bean.id,
              label: bean.name,
              detail: selection.selecting && bean.archived ? 'Archived' : beanDetail(bean),
              locked: bean.archived,
              // Shown with Show archived, an archived bean says so; in select mode its line does.
              badge: bean.archived ? (
                selection.selecting ? undefined : (
                  <Badge>Archived</Badge>
                )
              ) : bean.greenG < bean.lowStockG ? (
                <Badge tone="heat">Low</Badge>
              ) : undefined,
            }))}
            openId={right.kind === 'bean' ? open?.id : undefined}
            onOpen={showBean}
            {...(selection.selecting
              ? { checked: selection.checked, onCheck: selection.check }
              : {})}
          />
          <Button
            variant="ghost"
            // px-3 like the list rows above, so the icon lines up with their names.
            className="justify-start px-3"
            icon={<Plus aria-hidden="true" />}
            aria-current={right.kind === 'add' ? 'true' : undefined}
            onClick={() => {
              setRight({ kind: 'add' });
            }}
          >
            Add bean
          </Button>
          <Dialog
            open={calculating}
            onOpenChange={setCalculating}
            title="Batch calculator"
            description="What an order makes in equal batches on the active roaster"
          >
            <BatchCalculator
              orderG={orderG}
              onOrderG={setOrderG}
              batchG={calcBatchG}
              onBatchG={setCalcBatchG}
            />
          </Dialog>
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
      ) : open ? (
        <BeanDetail
          key={open.id}
          bean={open}
          beans={beans}
          roasts={roasts}
          onRoast={onRoast}
          onOpenProfile={onOpenProfile}
          onOpenRoast={onOpenRoast}
        />
      ) : (
        <p className="flex min-h-control-sm items-center text-body text-ink-muted">
          No beans yet · add one to track its stock and find its best roast
        </p>
      )}
    </SidebarLayout>
  );
}
