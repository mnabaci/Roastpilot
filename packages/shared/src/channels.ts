import { z } from 'zod';

/** Something a driver reads, such as bean temperature. Values are in °C. */
export const SensorChannelSchema = z.object({
  id: z.string(),
  kind: z.literal('sensor'),
  unit: z.literal('celsius'),
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
export type OutputChannel = z.infer<typeof OutputChannelSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type Reading = z.infer<typeof ReadingSchema>;
