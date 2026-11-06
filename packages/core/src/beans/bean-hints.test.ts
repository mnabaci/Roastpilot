import { describe, expect, it } from 'vitest';
import { beanHints } from './bean-hints';

const PLAIN = { process: 'washed', decaf: false, densityGL: null, moisturePct: null } as const;

describe('beanHints', () => {
  it('says nothing about a bean with nothing to go on', () => {
    expect(beanHints(PLAIN)).toEqual([]);
  });

  it.each([
    [{ process: 'natural' }, 'brown faster'],
    [{ process: 'honey' }, 'brown faster'],
    [{ decaf: true }, 'Decaf'],
    [{ densityGL: 650 }, 'Soft beans'],
    [{ densityGL: 850 }, 'Dense beans'],
    [{ moisturePct: 13 }, 'Wetter beans'],
  ] as const)('%o gets its hint', (change, text) => {
    expect(beanHints({ ...PLAIN, ...change })[0]).toContain(text);
  });

  it('stays quiet in the middle of the density and moisture ranges', () => {
    expect(beanHints({ ...PLAIN, densityGL: 750, moisturePct: 11 })).toEqual([]);
    expect(beanHints({ ...PLAIN, densityGL: 700 })).toEqual([]);
    expect(beanHints({ ...PLAIN, densityGL: 800 })).toEqual([]);
    expect(beanHints({ ...PLAIN, moisturePct: 12 })).toEqual([]);
  });

  it('shows at most two, in order', () => {
    const hints = beanHints({ process: 'natural', decaf: true, densityGL: 650, moisturePct: 13 });
    expect(hints).toHaveLength(2);
    expect(hints[0]).toContain('brown faster');
    expect(hints[1]).toContain('Decaf');
  });
});
