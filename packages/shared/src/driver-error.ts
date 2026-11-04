import { z } from 'zod';

/** Expected failures a driver reports instead of throwing. Crosses IPC, so it is a schema. */
export const DriverErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('disconnected') }),
  z.object({ kind: z.literal('no-reply'), command: z.string() }),
  /** `actual` is null when nothing answered VERSION: an old sketch, or a bad cable or ground. */
  z.object({
    kind: z.literal('version-mismatch'),
    expected: z.number(),
    actual: z.number().nullable(),
  }),
  z.object({ kind: z.literal('bad-reply'), line: z.string() }),
  z.object({ kind: z.literal('unknown-channel'), channel: z.string() }),
  /** Refused by the safety lock after a safe stop (docs/spec/safety.md). */
  z.object({ kind: z.literal('safety-locked'), channel: z.string() }),
]);

export type DriverError = z.infer<typeof DriverErrorSchema>;
