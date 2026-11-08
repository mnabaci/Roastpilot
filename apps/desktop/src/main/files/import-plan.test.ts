import { describe, expect, it } from 'vitest';
import { importedName, planImport, sameContent } from './import-plan';

interface Item {
  name: string;
  temp: number;
}

const plan = (items: Item[], here: Item[], maxName = 64, archived: Item[] = []) =>
  planImport({
    items,
    here,
    archived,
    nameOf: (item) => item.name,
    withName: (item, name) => ({ ...item, name }),
    contentOf: ({ name: _name, ...content }) => content,
    maxName,
  });

describe('import plan', () => {
  it('adds what is new as it is', () => {
    expect(plan([{ name: 'Guji', temp: 1 }], [])).toEqual({
      add: [{ name: 'Guji', temp: 1 }],
      skipped: 0,
      archived: 0,
    });
  });

  it('skips the same name with the same content, and counts it', () => {
    expect(plan([{ name: 'Guji', temp: 1 }], [{ name: 'Guji', temp: 1 }])).toEqual({
      add: [],
      skipped: 1,
      archived: 0,
    });
  });

  it('adds the same name with other content as "<name> (imported)", never over yours', () => {
    expect(plan([{ name: 'Guji', temp: 2 }], [{ name: 'Guji', temp: 1 }])).toEqual({
      add: [{ name: 'Guji (imported)', temp: 2 }],
      skipped: 0,
      archived: 0,
    });
  });

  it('counts up when "(imported)" is taken: "(imported 2)", "(imported 3)"', () => {
    const here = [
      { name: 'Guji', temp: 1 },
      { name: 'Guji (imported)', temp: 2 },
      { name: 'Guji (imported 2)', temp: 3 },
    ];
    expect(plan([{ name: 'Guji', temp: 4 }], here).add).toEqual([
      { name: 'Guji (imported 3)', temp: 4 },
    ]);
  });

  it('skips one already imported under a new name', () => {
    const here = [
      { name: 'Guji', temp: 1 },
      { name: 'Guji (imported)', temp: 2 },
    ];
    expect(plan([{ name: 'Guji', temp: 2 }], here)).toEqual({ add: [], skipped: 1, archived: 0 });
  });

  it('takes the file in order: a repeat in the same file counts as already here', () => {
    const items = [
      { name: 'Guji', temp: 1 },
      { name: 'Guji', temp: 1 },
      { name: 'Guji', temp: 2 },
    ];
    expect(plan(items, [])).toEqual({
      add: [
        { name: 'Guji', temp: 1 },
        { name: 'Guji (imported)', temp: 2 },
      ],
      skipped: 1,
      archived: 0,
    });
  });

  it('shortens a long name so the suffix still fits', () => {
    expect(importedName('Long name', 1, 15)).toBe('Long (imported)');
    expect(importedName('Long name', 2, 16)).toBe('Lon (imported 2)');
    expect(importedName('Guji', 1, 64)).toBe('Guji (imported)');
  });

  it('compares content whatever the order of its keys', () => {
    expect(
      sameContent({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 }),
    ).toBe(true);
    expect(sameContent({ a: 1, b: [1, 2] }, { a: 1, b: [2, 1] })).toBe(false);
    expect(sameContent({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it('counts a match with an archived item apart, since it is hidden', () => {
    const archived = [{ name: 'Guji', temp: 1 }];
    const items = [
      { name: 'Guji', temp: 1 },
      { name: 'Sidamo', temp: 2 },
      { name: 'Kenya', temp: 3 },
    ];
    expect(plan(items, [{ name: 'Sidamo', temp: 2 }], 64, archived)).toEqual({
      add: [{ name: 'Kenya', temp: 3 }],
      skipped: 1,
      archived: 1,
    });
  });

  it('a clash with an archived name still comes in renamed', () => {
    const archived = [{ name: 'Guji', temp: 1 }];
    expect(plan([{ name: 'Guji', temp: 2 }], [], 64, archived)).toEqual({
      add: [{ name: 'Guji (imported)', temp: 2 }],
      skipped: 0,
      archived: 0,
    });
  });
});
