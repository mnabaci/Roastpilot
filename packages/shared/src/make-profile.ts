import { z } from 'zod';
import { BeanIdSchema } from './bean';
import { ProfileIdSchema } from './profile';

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

/** "Make a profile" on a bean: a copy of `profileId`, named after the bean and linked to it. */
export const MakeBeanProfileRequestSchema = z.object({
  beanId: BeanIdSchema,
  profileId: ProfileIdSchema,
});

export const MakeBeanProfileErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('bean-not-found'), id: BeanIdSchema }),
  z.object({ kind: z.literal('profile-not-found'), id: ProfileIdSchema }),
  /** Nothing is left behind: a copy made before the failure is deleted again. */
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

export type MakeBeanProfileRequest = z.infer<typeof MakeBeanProfileRequestSchema>;
export type MakeBeanProfileError = z.infer<typeof MakeBeanProfileErrorSchema>;
