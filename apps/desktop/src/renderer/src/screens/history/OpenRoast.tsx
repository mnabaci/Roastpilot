import type { Bean } from '@roastpilot/shared';
import { EventTable } from '@roastpilot/ui';
import { RoastResultForm } from '../../features/RoastResultForm';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { BeanLink } from './BeanLink';
import { eventRows } from './event-rows';
import { SavedRoastChart } from './SavedRoastChart';
import { SavedRoastStats } from './SavedRoastStats';
import type { SavedRoastState } from './use-saved-roast';

/** The open roast's numbers, bean, result, chart and events, or why there is none to show. */
export function OpenRoast({
  selected,
  compared,
  compareLabel,
  live,
  beans,
  smoothingS,
  showPreheat,
  onShowPreheat,
}: {
  selected: SavedRoastState;
  compared: SavedRoastState;
  compareLabel: string;
  /** Being roasted right now: its bean stays as the roast set it. */
  live: boolean;
  beans: readonly Bean[];
  smoothingS: number;
  /** Kept by History while you browse it, so each roast opens the same way. */
  showPreheat: boolean;
  onShowPreheat: (show: boolean) => void;
}) {
  const unit = useTemperatureUnit();
  switch (selected.status) {
    case 'none':
      return <p className="text-body text-ink-muted">No roasts match these filters</p>;
    case 'loading':
      return <p className="text-label text-ink-muted">Loading…</p>;
    case 'failed':
      return (
        <p role="alert" className="text-body text-critical-text">
          Couldn't open this roast · see Logs
        </p>
      );
    case 'loaded': {
      const { detail } = selected;
      return (
        <>
          <SavedRoastStats roast={detail} />
          {/* Keyed, so a problem linking one roast doesn't follow you to the next. */}
          {live ? null : <BeanLink key={detail.id} roast={detail} beans={beans} />}
          <RoastResultForm key={detail.id} roast={detail} />
          <SavedRoastChart
            detail={detail}
            compare={compared.status === 'loaded' ? compared.detail : undefined}
            compareLabel={compareLabel}
            smoothingS={smoothingS}
            showPreheat={showPreheat}
            onShowPreheat={onShowPreheat}
          />
          <EventTable rows={eventRows(detail, unit)} />
        </>
      );
    }
  }
}
