import { z } from 'zod';
import { ConnectTargetSchema } from './connection';
import { DEFAULT_PROFILE_ID, ProfileIdSchema } from './profile';
import { DEFAULT_SOUNDS, SoundsSchema } from './sounds';

/** How much of the Roast screen is live (docs/spec/manual-mode.md, Guided and Full control). */
export const ControlsLevelSchema = z.enum(['guided', 'full']);

/** Seconds of readings the temperature line averages; 3 s is Artisan's default (3 readings at 1 s). */
export const ChartSmoothingSchema = z.union([
  z.literal(0),
  z.literal(3),
  z.literal(5),
  z.literal(10),
]);

/** Bean cooling countdown in minutes (docs/spec/manual-mode.md, Bean cooling). */
export const CoolingTimeSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

/** Drum cooling runs until BT is below this, in °C. */
export const RoasterCoolToSchema = z.union([
  z.literal(40),
  z.literal(50),
  z.literal(60),
  z.literal(70),
]);

/** Who drives heater and fan during a roast (docs/spec/roast-control.md, Auto mode). */
export const RoastModeSchema = z.enum(['manual', 'auto']);

/** Dark, Light, or whatever the computer is set to (docs/spec/ui.md, Settings). */
export const ThemeSchema = z.enum(['dark', 'light', 'system']);

/** The safety notice's wording; raise it when the wording changes so everyone reads it again. */
export const SAFETY_NOTICE_VERSION = 1;

/** Missing or unknown fields fall back to defaults, so an older settings file still loads. */
export const SettingsSchema = z.object({
  /** The roaster last picked in Settings; the app never connects by itself. */
  connection: ConnectTargetSchema.nullable().catch(null).default(null),
  controls: ControlsLevelSchema.catch('guided').default('guided'),
  chartSmoothingS: ChartSmoothingSchema.catch(3).default(3),
  /** Move charge back to the charge drop found before Start was pressed. */
  findChargePoint: z.boolean().catch(true).default(true),
  /** The coach card in a manual roast (docs/spec/manual-mode.md, Coach). */
  coachInManual: z.boolean().catch(true).default(true),
  coolingTimeMin: CoolingTimeSchema.catch(4).default(4),
  /** Drum cooling from Drop, down to `roasterCoolToC`. An older `coolingEnd` is dropped. */
  coolRoasterAfter: z.boolean().catch(true).default(true),
  roasterCoolToC: RoasterCoolToSchema.catch(50).default(50),
  /** Manual unless you choose Auto, so an update never hands your roast to the controller. */
  roastMode: RoastModeSchema.catch('manual').default('manual'),
  autoProfile: ProfileIdSchema.catch(DEFAULT_PROFILE_ID).default(DEFAULT_PROFILE_ID),
  /** Sounds when something needs you, and before first crack (docs/spec/ui.md, Sounds). */
  sounds: SoundsSchema.catch(DEFAULT_SOUNDS).default(DEFAULT_SOUNDS),
  /** Dark unless you choose otherwise, so an update never changes how the app looks. */
  theme: ThemeSchema.catch('dark').default('dark'),
  /** The safety notice version you accepted; 0 until you do (docs/spec/safety.md, Safety notice). */
  safetyNoticeAccepted: z.number().int().min(0).catch(0).default(0),
});

/** True while the safety notice in this version still needs accepting. */
export const needsSafetyNotice = (settings: Settings): boolean =>
  settings.safetyNoticeAccepted < SAFETY_NOTICE_VERSION;

export const DEFAULT_SETTINGS = SettingsSchema.parse({});

export const SettingsWriteErrorSchema = z.object({
  kind: z.literal('write-failed'),
  message: z.string(),
});

export type ControlsLevel = z.infer<typeof ControlsLevelSchema>;
export type ChartSmoothing = z.infer<typeof ChartSmoothingSchema>;
export type CoolingTime = z.infer<typeof CoolingTimeSchema>;
export type RoasterCoolTo = z.infer<typeof RoasterCoolToSchema>;
export type RoastMode = z.infer<typeof RoastModeSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsWriteError = z.infer<typeof SettingsWriteErrorSchema>;
