import { RoastStrip } from '@roastpilot/ui';
import { useMemo } from 'react';
import { useAuto, useRoast } from '../stores/use-stores';
import { roastStripData } from './roast-strip-data';
import { useSensorNames } from '../features/use-sensor-names';
import { useTemperatureUnit } from '../features/use-temperature-unit';

/** The roast strip, while a roast runs; nothing otherwise. */
export function LiveRoastStrip({ onOpen }: { onOpen: () => void }) {
  const roast = useRoast((s) => s.roast);
  const readings = useRoast((s) => s.readings);
  const auto = useAuto((s) => s.status);
  const { short } = useSensorNames();
  const unit = useTemperatureUnit();
  const data = useMemo(
    () => roastStripData(roast, readings, { tempShort: short, auto, unit }),
    [roast, readings, short, auto, unit],
  );
  return data ? <RoastStrip {...data} onOpen={onOpen} /> : null;
}
