import { bestFavourite, beanHints, suggestProfile } from '@roastpilot/core';
import { BeanFieldsSchema, type Bean, type RoastSummary } from '@roastpilot/shared';
import { Badge, Button, formatNumber, RoastList, StatCard } from '@roastpilot/ui';
import { useState } from 'react';
import { useDeps } from '../../app/app-context';
import { useRun } from '../../features/use-run';
import { useAuto, useRoast, useRoasters } from '../../stores/use-stores';
import { activeRoaster } from '../../stores/roasters-store';
import { roastNumbers, roastTitle } from '../history/history-format';
import { setupForBean } from '../roast/roast-setup';
import { describePlan } from './batch-format';
import { BeanEditor } from './BeanEditor';
import { BeanFacts } from './BeanFacts';
import { AddStockForm, AdjustStockForm } from './StockForms';

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
  const { api, stores } = useDeps();
  const run = useRun();
  const [panel, setPanel] = useState<Panel>('none');
  const [problem, setProblem] = useState<string>();
  const profiles = useAuto((s) => s.profiles);
  // The running roast keeps its bean: the next one is set up once it's over.
  const roastRunning = useRoast((s) => s.roast.phase !== 'ready' && s.roast.phase !== 'done');
  const roaster = activeRoaster(useRoasters((s) => s.roasters));
  const own = roasts.filter((r) => r.beanId === bean.id);
  const best = bestFavourite(own);
  const close = () => {
    setPanel('none');
  };

  const roastThis = () => {
    if (!roaster) return;
    const setup = setupForBean(bean, {
      roaster,
      roasts,
      profileId: stores.settings.getState().settings.autoProfile,
    });
    stores.beans.setState({ setup });
    run('beans.setup-failed', async () => {
      await api.setRoastSetup(setup);
      onRoast();
    });
  };

  /** Duplicates the suggested profile, names it after the bean and opens it in the editor. */
  const makeProfile = () => {
    const suggested = suggestProfile({
      bean,
      beans,
      roasts,
      available: profiles.map((e) => e.profile.id),
    });
    if (!suggested) return;
    run('beans.make-profile-failed', async () => {
      const copy = await api.duplicateProfile(suggested.profileId);
      const named = copy.ok && (await api.saveProfile({ ...copy.value.profile, name: bean.name }));
      const profileId = named && named.ok ? named.value.profile.id : undefined;
      const linked =
        profileId !== undefined &&
        (await api.updateBean({ id: bean.id, fields: BeanFieldsSchema.parse(bean), profileId }));
      if (profileId === undefined || !linked || !linked.ok) {
        setProblem("Couldn't make the profile · see Logs");
        return;
      }
      stores.auto.setState({ profiles: await api.listProfiles() });
      onOpenProfile(profileId);
    });
  };

  if (panel === 'edit') return <BeanEditor bean={bean} onDone={close} onAdded={close} />;

  const low = bean.greenG < bean.lowStockG;
  return (
    <section aria-label={bean.name} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-heading">{bean.name}</h2>
        {low ? <Badge tone="heat">Low stock</Badge> : null}
        {bean.archived ? <Badge>Archived</Badge> : null}
      </div>
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
      <div className="flex flex-wrap gap-2">
        <Button
          // One primary at a time: an open form has its own.
          variant={panel === 'none' ? 'primary' : 'secondary'}
          disabled={bean.archived || roastRunning}
          onClick={roastThis}
        >
          Roast this bean
        </Button>
        <Button
          onClick={() => {
            setPanel('add-stock');
          }}
        >
          Add stock
        </Button>
        <Button
          onClick={() => {
            setPanel('adjust-stock');
          }}
        >
          Adjust stock
        </Button>
        <Button
          onClick={() => {
            setPanel('edit');
          }}
        >
          Edit
        </Button>
        <Button onClick={makeProfile}>
          {bean.profileId === null ? 'Make a profile for this bean' : 'Make another profile'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            run('beans.archive-failed', async () => {
              await api.setBeanArchived({ id: bean.id, archived: !bean.archived });
            });
          }}
        >
          {bean.archived ? 'Bring back' : 'Archive'}
        </Button>
      </div>
      {problem ? (
        <p role="alert" className="text-label text-critical-text">
          {problem}
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
      <div className="flex flex-col gap-2">
        <h3 className="text-label text-ink-muted">
          {best ? `Best favourite: ${roastTitle(best.startedAt)}` : 'No favourite yet'}
        </h3>
        {own.length > 0 ? (
          <RoastList
            label={`Roasts of ${bean.name}`}
            selectedId={best?.id}
            onSelect={() => undefined}
            items={own.map((r) => ({
              id: r.id,
              title: roastTitle(r.startedAt),
              numbers: roastNumbers(r),
              favourite: r.isFavourite,
              ...(r.rating === null ? {} : { detail: `${String(r.rating)}/5` }),
            }))}
          />
        ) : (
          <p className="text-label text-ink-muted">No roasts of this bean yet.</p>
        )}
      </div>
    </section>
  );
}
