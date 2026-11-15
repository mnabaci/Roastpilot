import type { AutoProfile, RoastDetail, SavedEvent, SavedSample } from '@roastpilot/shared';

/**
 * A roast's BT, one reading a second: charge at 180 °C, down to 90 °C at 1:00 (the turning point),
 * then climbing at `rorAt(tS)` °C/min. Readings run to `toS`, a little past drop, as saved roasts do.
 */
export function samplesFromRor(
  rorAt: (tS: number) => number,
  toS: number,
  { everyS = 1, skip = () => false }: { everyS?: number; skip?: (tS: number) => boolean } = {},
): SavedSample[] {
  const samples: SavedSample[] = [];
  let bt = 180;
  for (let tS = 0; tS <= toS; tS += everyS) {
    if (tS <= 60) bt = 180 - (90 * tS) / 60;
    else bt += (rorAt(tS) / 60) * everyS;
    if (!skip(tS)) samples.push({ tS, values: { bt: Math.round(bt * 100) / 100 } });
  }
  return samples;
}

/** A light roast's RoR: 20 °C/min after the turning point, easing to 8 at 9:00 and 4 at 11:00. */
export const steadyRor = (tS: number): number =>
  tS <= 540 ? 20 - ((tS - 60) / 480) * 12 : 8 - ((tS - 540) / 120) * 4;

/** BT at `tS` in these samples (exact, as they come one a second). */
export const btIn = (samples: readonly SavedSample[], tS: number): number =>
  samples.find((s) => s.tS === tS)?.values.bt ?? Number.NaN;

const event = (kind: SavedEvent['kind'], tS: number, detail?: string): SavedEvent => ({
  kind,
  tS,
  bt: null,
  ...(detail === undefined ? {} : { detail }),
});

/**
 * A saved Manual roast with these samples: turning point at 1:00, first crack and drop where
 * given (null leaves one out), events in time order.
 */
export function savedRoast({
  samples,
  fcS = 540,
  dropS = 660,
  events = [],
  mode = 'manual',
  profile = null,
}: {
  samples: SavedSample[];
  fcS?: number | null;
  dropS?: number | null;
  events?: SavedEvent[];
  mode?: RoastDetail['mode'];
  profile?: AutoProfile | null;
}): RoastDetail {
  const all = [
    event('charge', 0),
    event('turning-point', 60),
    ...(fcS === null ? [] : [event('first-crack', fcS)]),
    ...(dropS === null ? [] : [event('drop', dropS)]),
    ...events,
  ].sort((a, b) => a.tS - b.tS);
  return {
    id: 1,
    startedAt: '2026-11-14T09:00:00.000Z',
    endedAt: dropS === null ? null : '2026-11-14T09:15:00.000Z',
    fcTimeS: fcS,
    fcTemp: fcS === null ? null : btIn(samples, fcS),
    tpTemp: 90,
    dropTimeS: dropS,
    dropTemp: dropS === null ? null : btIn(samples, dropS),
    roasterId: 1,
    beanId: null,
    ghostRoastId: null,
    batchG: 350,
    roastedG: 300,
    rating: null,
    isFavourite: false,
    notes: null,
    profileId: profile?.id ?? null,
    profileName: profile?.name ?? null,
    imported: false,
    mode,
    profile,
    samples,
    events: all,
  };
}

export { event as savedEvent };
