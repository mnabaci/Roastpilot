import type { RoastDetail, SavedEvent } from '@roastpilot/shared';

/** BT a reading a second: charge 180 °C, 90 °C at 1:00, then up at a steady 15 °C/min. */
const samples = Array.from({ length: 701 }, (_, tS) => ({
  tS,
  values: { bt: tS <= 60 ? 180 - 1.5 * tS : 90 + ((tS - 60) * 15) / 60 },
}));
const bt = (tS: number) => samples[tS]?.values.bt ?? null;
const event = (kind: SavedEvent['kind'], tS: number): SavedEvent => ({ kind, tS, bt: bt(tS) });

/** A saved Manual roast of those readings, first crack and drop where given. */
export const reportRoast = (fcS: number, dropS: number | null): RoastDetail => ({
  id: 1,
  startedAt: '2026-11-14T09:00:00.000Z',
  endedAt: dropS === null ? null : '2026-11-14T09:15:00.000Z',
  fcTimeS: fcS,
  fcTemp: bt(fcS),
  tpTemp: 90,
  dropTimeS: dropS,
  dropTemp: dropS === null ? null : bt(dropS),
  roasterId: 1,
  beanId: null,
  ghostRoastId: null,
  batchG: 350,
  roastedG: 300,
  rating: null,
  isFavourite: false,
  notes: null,
  profileId: null,
  profileName: null,
  imported: false,
  mode: 'manual',
  profile: null,
  samples,
  events: [
    event('charge', 0),
    event('turning-point', 60),
    event('first-crack', fcS),
    ...(dropS === null ? [] : [event('drop', dropS)]),
  ],
});
