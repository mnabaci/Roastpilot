import { z } from 'zod';

/** The app's screens (docs/spec/ui.md). Main opens one from the app menu. */
export const ScreenSchema = z.enum(['roast', 'history', 'settings', 'logs']);
export type Screen = z.infer<typeof ScreenSchema>;
