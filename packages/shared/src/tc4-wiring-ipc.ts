import { z } from 'zod';
import { ConnectErrorSchema, DriverErrorSchema } from './driver-error';
import { RoasterErrorSchema, RoasterIdSchema } from './roaster';
import { MIN_FAN_HEATING, Tc4WiringSchema } from './tc4-wiring';

/** Saving a TC4 roaster's wiring, which may happen while it is connected (not while roasting). */
export const SaveWiringRequestSchema = z.object({
  id: RoasterIdSchema,
  wiring: Tc4WiringSchema,
  minFanHeatingPct: z
    .number()
    .min(MIN_FAN_HEATING.minPct)
    .max(MIN_FAN_HEATING.maxPct)
    .multipleOf(MIN_FAN_HEATING.stepPct),
});

/** TC1–TC4 as read now, °C; null where an input has no probe (docs/spec/roasters.md). */
export const Tc4InputsSchema = z.array(z.number().nullable()).length(4);

export const ReadInputsErrorSchema = z.union([
  DriverErrorSchema,
  /** No roaster connected, or one whose board can't read its inputs one by one. */
  z.object({ kind: z.literal('unavailable') }),
  /** A roast is running: the inputs stay as they are. */
  z.object({ kind: z.literal('roasting') }),
]);

export const SaveWiringErrorSchema = z.union([
  RoasterErrorSchema,
  z.object({ kind: z.literal('roasting') }),
  /** Saved, but the connected roaster didn't come back with it: why, as Connect would say. */
  z.object({ kind: z.literal('reconnect-failed'), error: ConnectErrorSchema }),
]);

export type SaveWiringRequest = z.infer<typeof SaveWiringRequestSchema>;
export type Tc4Inputs = z.infer<typeof Tc4InputsSchema>;
export type ReadInputsError = z.infer<typeof ReadInputsErrorSchema>;
export type SaveWiringError = z.infer<typeof SaveWiringErrorSchema>;
