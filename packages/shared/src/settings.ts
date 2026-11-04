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

/** What ends bean cooling: the countdown, or BT falling below a temperature. */
export const CoolingEndSchema = z.enum(['time', 'temperature']);

/** Bean cooling by temperature ends once BT is below this, in °C. */
export const CoolingBelowSchema = z.union([
  z.literal(70),
  z.literal(80),
  z.literal(90),
  z.literal(100),
]);

/** The roaster cool-down runs until BT is below this, in °C. */
export const RoasterCoolToSchema = z.union([
  z.literal(40),
  z.literal(50),
  z.literal(60),
  z.literal(70),
]);

/** Missing or unknown fields fall back to defaults, so an older settings file still loads. */
export const SettingsSchema = z.object({
  /** The roaster last picked in Settings; the app never connects by itself. */
  connection: ConnectTargetSchema.nullable().catch(null).default(null),
  controls: ControlsLevelSchema.catch('guided').default('guided'),
  chartSmoothingS: ChartSmoothingSchema.catch(3).default(3),
  /** Move charge back to the charge drop found before Start was pressed. */
  findChargePoint: z.boolean().catch(true).default(true),
  coolingEnd: CoolingEndSchema.catch('time').default('time'),
  coolingTimeMin: CoolingTimeSchema.catch(4).default(4),
  coolingBelowC: CoolingBelowSchema.catch(90).default(90),
  /** Keep cooling the empty roaster after bean cooling, down to `roasterCoolToC`. */
  coolRoasterAfter: z.boolean().catch(true).default(true),
  roasterCoolToC: RoasterCoolToSchema.catch(50).default(50),
});

export const DEFAULT_SETTINGS = SettingsSchema.parse({});

export const SettingsWriteErrorSchema = z.object({
  kind: z.literal('write-failed'),
  message: z.string(),
});

export type ControlsLevel = z.infer<typeof ControlsLevelSchema>;
export type ChartSmoothing = z.infer<typeof ChartSmoothingSchema>;
export type CoolingTime = z.infer<typeof CoolingTimeSchema>;
export type CoolingEnd = z.infer<typeof CoolingEndSchema>;
export type CoolingBelow = z.infer<typeof CoolingBelowSchema>;
export type RoasterCoolTo = z.infer<typeof RoasterCoolToSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsWriteError = z.infer<typeof SettingsWriteErrorSchema>;
