import type { RoastEvent } from '@roastpilot/shared';
import type { RoastPlan, RoastSummaryPatch } from './roast-repository';

/** How a roast runs when nothing says otherwise. */
export const MANUAL_PLAN: RoastPlan = {
  mode: 'manual',
  profile: null,
  roasterId: null,
  beanId: null,
  batchG: null,
  ghostRoastId: null,
};

/** Milliseconds as seconds, to the millisecond. */
export const toSeconds = (ms: number) => Math.round(ms) / 1000;

/** What an event's patch may read besides the event. */
interface PatchContext {
  nowIso: string;
  plan: () => RoastPlan;
}

/** What each event adds to the roast's summary row. */
export const SUMMARY_FROM_EVENT: Readonly<
  Record<
    RoastEvent['kind'],
    (tS: number, event: RoastEvent, ctx: PatchContext) => RoastSummaryPatch
  >
> = {
  charge: () => ({}),
  'turning-point': () => ({}),
  'dry-end': () => ({}),
  phase: () => ({}),
  override: () => ({}),
  'stall-guard': () => ({}),
  'first-crack': (tS) => ({ fcTimeS: tS }),
  drop: (tS, event) => ({ dropTimeS: tS, dropTemp: event.bt }),
  'cool-end': (_tS, _event, { nowIso }) => ({ endedAt: nowIso }),
  // Auto turned on mid-roast: saved as an Auto roast, with the profile it ran. Turned off, the
  // roast keeps what it was, since Auto ran part of it.
  mode: (_tS, event, { plan }) => {
    if (event.detail !== 'auto') return {};
    const { mode, profile } = plan();
    return mode === 'auto' ? { mode, profile } : {};
  },
  end: (_tS, _event, { nowIso }) => ({ endedAt: nowIso }),
};
