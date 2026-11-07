import type { SampleColumns, SavedSample } from '@roastpilot/shared';

/** Readings and times go into a file to 0.1: what the sensors and the chart need (ADR 0015). */
const round = (value: number) => Math.round(value * 10) / 10;

/** Samples as columns: each channel's name once per roast instead of once per reading. */
export function toColumns(samples: readonly SavedSample[]): SampleColumns {
  const channels = [...new Set(samples.flatMap((s) => Object.keys(s.values)))];
  return {
    tS: samples.map((s) => round(s.tS)),
    values: Object.fromEntries(
      channels.map((channel) => [
        channel,
        samples.map((s) => {
          const value = s.values[channel];
          return value === undefined ? null : round(value);
        }),
      ]),
    ),
  };
}

/** Columns back to samples; a `null` leaves that channel out of its sample. */
export function fromColumns(columns: SampleColumns): SavedSample[] {
  const channels = Object.entries(columns.values);
  return columns.tS.map((tS, i) => ({
    tS,
    values: Object.fromEntries(
      channels.flatMap(([channel, column]) => {
        const value = column[i];
        return value === null || value === undefined ? [] : [[channel, value]];
      }),
    ),
  }));
}
