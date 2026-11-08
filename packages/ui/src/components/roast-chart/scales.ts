import type uPlot from 'uplot';
import type { TimeRange } from './drag-handles';

/** Time ticks land on whole steps (10 s up to 10 min), so labels never repeat. */
export const TIME_STEPS_S = [10, 15, 30, 60, 120, 300, 600];
/** At least a minute of time is shown, so the first seconds of a roast don't fill the width. */
export const MIN_TIME_SPAN_S = 60;

export const TIME_RANGE: uPlot.Range.Function = (_u, min, max) => {
  // uPlot passes null-ish bounds before there is any data.
  const start = Number.isFinite(min) ? Math.floor(min) : 0;
  const end = Number.isFinite(max) ? Math.ceil(max) : start;
  return [start, Math.max(end, start + MIN_TIME_SPAN_S)];
};

/** RoR's right axis shows at least 0–30 °C/min (design system), widened when RoR goes outside. */
export const ROR_MAX = 30;
export const ROR_RANGE: uPlot.Range.Function = (_u, min, max) => [
  // No RoR yet (before charge) leaves the bounds null-ish: keep the default span.
  Number.isFinite(min) ? Math.min(0, Math.floor(min)) : 0,
  Number.isFinite(max) ? Math.max(ROR_MAX, Math.ceil(max)) : ROR_MAX,
];

/**
 * The temperature axis is fixed from its floor (0 °C, Artisan's default; 50 °C with Temperature
 * focus) to 250 °C and grows in 50 °C steps. The floor is read at draw time.
 */
export const TEMPERATURE_MAX_C = 250;
const TEMPERATURE_STEP_C = 50;
export const temperatureRange =
  (floorC: () => number): uPlot.Range.Function =>
  (_u, _min, max) => [
    floorC(),
    Number.isFinite(max) && max > TEMPERATURE_MAX_C
      ? Math.ceil(max / TEMPERATURE_STEP_C) * TEMPERATURE_STEP_C
      : TEMPERATURE_MAX_C,
  ];

/** Outputs run 0–100 %; a little headroom keeps a line at 100 % from being cut in half. */
export const OUTPUT_RANGE: uPlot.Range.MinMax = [-4, 104];
export const OUTPUT_TICKS = [0, 50, 100];

/** The shared time scale; `adjust` changes the range that fits the data, read at draw time. */
export const xScale = (adjust: ((fitted: TimeRange) => TimeRange) | undefined): uPlot.Scale => ({
  time: false,
  range: adjust
    ? (u, min, max, scale) => {
        const [from, to] = adjust(TIME_RANGE(u, min, max, scale) as [number, number]);
        return [from, to];
      }
    : TIME_RANGE,
});
