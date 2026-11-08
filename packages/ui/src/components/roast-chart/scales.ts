import type { TemperatureUnit } from '@roastpilot/shared';
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

/**
 * RoR's right axis shows at least 0–30 °C/min (design system), the same 0–54 °F/min in °F, widened
 * when RoR goes outside.
 */
export const ROR_MAX: Readonly<Record<TemperatureUnit, number>> = { c: 30, f: 54 };
export const rorRange =
  (unit: TemperatureUnit): uPlot.Range.Function =>
  (_u, min, max) => [
    // No RoR yet (before charge) leaves the bounds null-ish: keep the default span.
    Number.isFinite(min) ? Math.min(0, Math.floor(min)) : 0,
    Number.isFinite(max) ? Math.max(ROR_MAX[unit], Math.ceil(max)) : ROR_MAX[unit],
  ];

/**
 * The temperature axis is fixed from its floor (0 °C, Artisan's default; fitted with Temperature
 * focus) to 250 °C and grows in 50 °C steps when the data, or an aid such as the projection
 * (`aidsTop`), goes hotter. In °F the same 250 °C top is 482 °F and it grows in 100 °F steps
 * (docs/spec/ui.md, Units). The floor, the data and the aids come in the unit shown, read at draw
 * time.
 */
export const TEMPERATURE_AXIS: Readonly<Record<TemperatureUnit, { max: number; step: number }>> = {
  c: { max: 250, step: 50 },
  f: { max: 482, step: 100 },
};
export const temperatureRange =
  (
    floor: () => number,
    aidsTop: () => number | undefined = () => undefined,
    unit: TemperatureUnit = 'c',
  ): uPlot.Range.Function =>
  (_u, _min, max) => {
    const { max: fixedTop, step } = TEMPERATURE_AXIS[unit];
    const top = Math.max(Number.isFinite(max) ? max : -Infinity, aidsTop() ?? -Infinity);
    return [floor(), top > fixedTop ? Math.ceil(top / step) * step : fixedTop];
  };

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
