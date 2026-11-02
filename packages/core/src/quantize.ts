import type { OutputChannel } from '@roastpilot/shared';

/**
 * Clamps a value to the channel's range and rounds it to the channel's step.
 * NaN becomes the minimum, so a bad value can never turn the heater up.
 */
export function quantize(channel: OutputChannel, value: number): number {
  if (Number.isNaN(value)) return channel.min;
  const clamped = Math.min(channel.max, Math.max(channel.min, value));
  const stepped = channel.min + Math.round((clamped - channel.min) / channel.step) * channel.step;
  // Rounding up can overshoot a max that is off the step grid; fall back to the step below.
  return stepped > channel.max ? stepped - channel.step : stepped;
}
