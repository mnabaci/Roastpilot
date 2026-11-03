import { z } from 'zod';

export const SafetyActionSchema = z.enum(['safe-stop', 'alarm']);

/** A safety rule tripping or clearing, or the heater lock lifting (docs/spec/safety.md). */
export const SafetyEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tripped'),
    rule: z.string(),
    action: SafetyActionSchema,
    atMs: z.number(),
  }),
  z.object({ kind: z.literal('cleared'), rule: z.string(), atMs: z.number() }),
  z.object({ kind: z.literal('unlocked'), atMs: z.number() }),
]);

export const AcknowledgeErrorSchema = z.object({
  kind: z.literal('still-tripped'),
  rules: z.array(z.string()),
});

export type SafetyAction = z.infer<typeof SafetyActionSchema>;
export type SafetyEvent = z.infer<typeof SafetyEventSchema>;
export type AcknowledgeError = z.infer<typeof AcknowledgeErrorSchema>;
