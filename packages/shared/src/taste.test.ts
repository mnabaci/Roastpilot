import { describe, expect, it } from 'vitest';
import { orderedTags, RoastTasteSchema, TASTE_TAG_LABELS, TASTE_TAGS } from './taste';

describe('taste tags', () => {
  it('has a label for every tag, in the spec order', () => {
    expect(TASTE_TAGS.map((tag) => TASTE_TAG_LABELS[tag])).toEqual([
      'Sour',
      'Grassy',
      'Thin',
      'Flat',
      'Baked',
      'Bitter',
      'Roasty',
      'Sweet and balanced',
    ]);
  });

  it('orders ticked tags as they show and drops repeats', () => {
    expect(orderedTags(['roasty', 'sour', 'roasty'])).toEqual(['sour', 'roasty']);
    expect(orderedTags([])).toEqual([]);
  });
});

describe('RoastTasteSchema', () => {
  const valid = { id: 4, tags: ['sour', 'thin'], words: 'tart, a bit hay-like' };

  it('accepts tags and words', () => {
    expect(RoastTasteSchema.parse(valid)).toEqual(valid);
  });

  it('accepts no tags and no words', () => {
    expect(RoastTasteSchema.safeParse({ id: 4, tags: [], words: null }).success).toBe(true);
  });

  it('trims the words', () => {
    expect(RoastTasteSchema.parse({ ...valid, words: '  tart  ' }).words).toBe('tart');
  });

  it.each([
    ['an unknown tag', { ...valid, tags: ['smoky'] }],
    ['words over 500 characters', { ...valid, words: 'a'.repeat(501) }],
    ['more tags than there are', { ...valid, tags: [...TASTE_TAGS, 'sour'] }],
    ['a roast id that is not positive', { ...valid, id: 0 }],
  ])('refuses %s', (_name, input) => {
    expect(RoastTasteSchema.safeParse(input).success).toBe(false);
  });
});
