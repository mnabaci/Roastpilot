import { z } from 'zod';
import { ConnectTargetSchema } from './connection';

/** How much of the Roast screen is live (docs/spec/manual-mode.md, Guided and Full control). */
export const ControlsLevelSchema = z.enum(['guided', 'full']);

/** Seconds of readings the temperature line averages; 3 s is Artisan's default (3 readings at 1 s). */
export const ChartSmoothingSchema = z.union([
  z.literal(0),
  z.literal(3),
  z.literal(5),
  z.literal(10),
]);

/** Bean cooling countdown in minutes (docs/spec/manual-mode.md, Cooling time). */
export const CoolingTimeSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

/** Missing or unknown fields fall back to defaults, so an older settings file still loads. */
export const SettingsSchema = z.object({
  /** The roaster last picked in Settings; the app never connects by itself. */
  connection: ConnectTargetSchema.nullable().catch(null).default(null),
  controls: ControlsLevelSchema.catch('guided').default('guided'),
  chartSmoothingS: ChartSmoothingSchema.catch(3).default(3),
  /** Move charge back to the charge drop found before Start was pressed. */
  findChargePoint: z.boolean().catch(true).default(true),
  coolingTimeMin: CoolingTimeSchema.catch(4).default(4),
  /** Keep cooling the empty roaster after bean cooling, down to 50 °C. */
  coolRoasterAfter: z.boolean().catch(true).default(true),
});

export const DEFAULT_SETTINGS = SettingsSchema.parse({});

export const SettingsWriteErrorSchema = z.object({
  kind: z.literal('write-failed'),
  message: z.string(),
});

export type ControlsLevel = z.infer<typeof ControlsLevelSchema>;
export type ChartSmoothing = z.infer<typeof ChartSmoothingSchema>;
export type CoolingTime = z.infer<typeof CoolingTimeSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsWriteError = z.infer<typeof SettingsWriteErrorSchema>;
