import type { Bean, RoastSummary } from '@roastpilot/shared';
import { CollapsibleCard } from '@roastpilot/ui';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useSettings } from '../../stores/use-stores';
import { useSaveSettings } from '../settings/use-save-settings';
import { BeanLink } from './BeanLink';
import { roastDetailsSummary } from './roast-details-summary';

/**
 * The open roast's bean, weights, rating, star and notes in one card that folds to a line
 * (docs/spec/ui.md, History). Open or folded is a setting, the same for every roast.
 */
export function RoastDetailsCard({
  roast,
  beans,
  live,
}: {
  roast: RoastSummary;
  beans: readonly Bean[];
  /** Being roasted right now: its bean stays as the roast set it. */
  live: boolean;
}) {
  const open = useSettings((s) => s.settings.historyDetailsOpen);
  const saveSettings = useSaveSettings();
  const summary = roastDetailsSummary(roast, beans);
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
    </CollapsibleCard>
  );
}
