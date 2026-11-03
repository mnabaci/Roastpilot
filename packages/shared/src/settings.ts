import { z } from 'zod';
import { ConnectTargetSchema } from './connection';

/** How much of the Roast screen is live (docs/spec/manual-mode.md, Guided and Full control). */
export const ControlsLevelSchema = z.enum(['guided', 'full']);

/** Missing or unknown fields fall back to defaults, so an older settings file still loads. */
export const SettingsSchema = z.object({
  /** The roaster last picked in Settings; the app never connects by itself. */
  connection: ConnectTargetSchema.nullable().catch(null).default(null),
  controls: ControlsLevelSchema.catch('guided').default('guided'),
});

export const DEFAULT_SETTINGS = SettingsSchema.parse({});

export const SettingsWriteErrorSchema = z.object({
  kind: z.literal('write-failed'),
  message: z.string(),
});

export type ControlsLevel = z.infer<typeof ControlsLevelSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsWriteError = z.infer<typeof SettingsWriteErrorSchema>;
