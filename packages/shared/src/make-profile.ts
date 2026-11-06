import { z } from 'zod';

export const MakeProfileRequestSchema = z.object({
  roastId: z.number().int().positive(),
  style: z.enum(['steps', 'curve']),
});

export const MakeProfileErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('not-found'), id: z.number() }),
  /** The roast has too little to go on, e.g. no dry end or no drop. */
  z.object({ kind: z.literal('too-short') }),
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

export type MakeProfileRequest = z.infer<typeof MakeProfileRequestSchema>;
export type MakeProfileError = z.infer<typeof MakeProfileErrorSchema>;
