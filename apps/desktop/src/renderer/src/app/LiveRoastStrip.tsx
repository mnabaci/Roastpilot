import { RoastStrip } from '@roastpilot/ui';
import { useMemo } from 'react';
import { useRoast } from '../stores/use-stores';
import { roastStripData } from './roast-strip-data';

/** The roast strip, while a roast runs; nothing otherwise. */
export function LiveRoastStrip({ onOpen }: { onOpen: () => void }) {
  const roast = useRoast((s) => s.roast);
  const readings = useRoast((s) => s.readings);
  const data = useMemo(() => roastStripData(roast, readings), [roast, readings]);
  return data ? <RoastStrip {...data} onOpen={onOpen} /> : null;
}
