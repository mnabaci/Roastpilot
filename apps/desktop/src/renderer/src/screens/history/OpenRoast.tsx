import type { Bean } from '@roastpilot/shared';
import { EventTable } from '@roastpilot/ui';
import { useTemperatureUnit } from '../../features/use-temperature-unit';
import { eventRows } from './event-rows';
import { RoastDetailsCard } from './RoastDetailsCard';
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
          <RoastDetailsCard roast={detail} beans={beans} live={live} />
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
