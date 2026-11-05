import { z } from 'zod';

/**
 * Something a driver reads. Values are in °C. The id is the role the app's logic uses (`bt`: the
 * temperature that follows the beans); `name` and `short` are what the roaster really measures,
 * for the screen (docs/spec/extensibility.md, Sensor names).
 */
export const SensorChannelSchema = z.object({
  id: z.string(),
  kind: z.literal('sensor'),
  unit: z.literal('celsius'),
  name: z.string().min(1),
  short: z.string().min(1),
});

/**
 * Something a driver controls. Values are clamped to [min, max] and rounded to `step`. `level` is
 * a small whole-number setting, such as the Skywalker filter fan (0–4).
 */
export const OutputChannelSchema = z.object({
  id: z.string(),
  kind: z.literal('output'),
  unit: z.enum(['percent', 'on-off', 'level']),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
});

export const ChannelSchema = z.discriminatedUnion('kind', [
  SensorChannelSchema,
  OutputChannelSchema,
]);

/** One poll of the roaster: a value per channel id, taken at `atMs` on the driver's clock. */
export const ReadingSchema = z.object({
  atMs: z.number(),
  values: z.record(z.string(), z.number()),
});

export type SensorChannel = z.infer<typeof SensorChannelSchema>;
export type SensorNames = Pick<SensorChannel, 'name' | 'short'>;

/** What the screen calls the temperature when no roaster names it (History, disconnected). */
export const DEFAULT_TEMP_NAMES: SensorNames = { name: 'Temperature', short: 'Temp' };

/** The names a roaster gives sensor `id`, or the neutral ones when it has none. */
export function sensorNames(channels: readonly Channel[], id: string): SensorNames {
  const sensor = channels.find((c) => c.id === id && c.kind === 'sensor');
  return sensor?.kind === 'sensor'
    ? { name: sensor.name, short: sensor.short }
    : DEFAULT_TEMP_NAMES;
}
export type OutputChannel = z.infer<typeof OutputChannelSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type Reading = z.infer<typeof ReadingSchema>;
