import type { RoastReport } from '@roastpilot/core';
import type { Bean, RoastDetail } from '@roastpilot/shared';
import { CollapsibleCard } from '@roastpilot/ui';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useAiHelpers } from '../../features/use-ai-keys';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import { BeanLink } from './BeanLink';
import { roastDetailsSummary } from './roast-details-summary';
import { TasteSection } from './TasteSection';

/**
 * The open roast's bean, weights, rating, star, notes and taste in one card that folds to a line
 * (docs/spec/ui.md, History). Open or folded is a setting, the same for every roast.
 */
export function RoastDetailsCard({
  roast,
  report,
  beans,
  live,
}: {
  roast: RoastDetail;
  /** Its report, for the taste suggestion; undefined until it can be measured. */
  report: RoastReport | undefined;
  beans: readonly Bean[];
  /** Being roasted right now: its bean stays as the roast set it. */
  live: boolean;
}) {
  const open = useSettings((s) => s.settings.historyDetailsOpen);
  const saveSettings = useSaveSettings();
  const summary = roastDetailsSummary(roast, beans);
  const ai = useAiHelpers();
  return (
    <CollapsibleCard
      title="Roast details"
      summary={summary?.shown}
      spokenSummary={summary?.spoken}
      open={open}
      onOpenChange={(next) => {
        saveSettings({ historyDetailsOpen: next });
      }}
    >
      {/* Keyed, so what you typed, or a problem linking one roast, doesn't follow you to the next. */}
      <RoastResultForm
        key={roast.id}
        roast={roast}
        lead={live ? null : <BeanLink key={roast.id} roast={roast} beans={beans} />}
      />
      {/* You taste after the coffee has rested, so not while it is being roasted. */}
      {live ? null : (
        <TasteSection
          key={roast.id}
          roast={roast}
          report={report}
          beanName={beans.find((b) => b.id === roast.beanId)?.name}
          canRead={ai.taste}
        />
      )}
    </CollapsibleCard>
  );
}
