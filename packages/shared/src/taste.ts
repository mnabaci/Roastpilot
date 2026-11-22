import { z } from 'zod';
import { BeanIdSchema } from './bean';

// Not saved-roast's RoastIdSchema: that file reads the tags, so importing it would loop.
const RoastIdSchema = z.number().int().positive();

/**
 * What a cup tasted like, in the order the tags show (docs/spec/beans-favourites-ghost.md, Taste).
 * Ids are stored; the labels are the screen's.
 */
export const TASTE_TAGS = [
  'sour',
  'grassy',
  'thin',
  'flat',
  'baked',
  'bitter',
  'roasty',
  'balanced',
] as const;

export const TasteTagSchema = z.enum(TASTE_TAGS);

export const TASTE_TAG_LABELS: Readonly<Record<TasteTag, string>> = {
  sour: 'Sour',
  grassy: 'Grassy',
  thin: 'Thin',
  flat: 'Flat',
  baked: 'Baked',
  bitter: 'Bitter',
  roasty: 'Roasty',
  balanced: 'Sweet and balanced',
};

/** Your tasting words, as read into tags (docs/spec/ai-helpers.md, Limits). */
export const TASTE_WORDS_MAX = 500;
export const TasteWordsSchema = z.string().trim().max(TASTE_WORDS_MAX);

/** Ticked tags, each once, in the tags' own order. */
export function orderedTags(tags: Iterable<TasteTag>): TasteTag[] {
  const ticked = new Set(tags);
  return TASTE_TAGS.filter((tag) => ticked.has(tag));
}

/** A roast's taste as saved from History: the tags ticked and your words. */
export const RoastTasteSchema = z.object({
  id: RoastIdSchema,
  tags: z.array(TasteTagSchema).max(TASTE_TAGS.length),
  words: TasteWordsSchema.nullable(),
});

/** Make <bean> profile: the roast's suggestion, worked out again in main from what is saved. */
export const MakeTasteProfileRequestSchema = z.object({ roastId: RoastIdSchema });

export const MakeTasteProfileErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('not-found'), id: RoastIdSchema }),
  /** The saved taste no longer suggests a change (the tags changed meanwhile). */
  z.object({ kind: z.literal('no-change') }),
  z.object({ kind: z.literal('bean-not-found'), id: BeanIdSchema }),
  /** Nothing is left behind: a profile made before the failure is deleted again. */
  z.object({ kind: z.literal('storage-failed'), message: z.string() }),
]);

export type TasteTag = z.infer<typeof TasteTagSchema>;
export type RoastTaste = z.infer<typeof RoastTasteSchema>;
export type MakeTasteProfileRequest = z.infer<typeof MakeTasteProfileRequestSchema>;
export type MakeTasteProfileError = z.infer<typeof MakeTasteProfileErrorSchema>;
