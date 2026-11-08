import { describe, expect, it } from 'vitest';
import { beanHints } from './bean-hints';

const PLAIN = { process: 'washed', decaf: false, densityGL: null, moisturePct: null } as const;

describe('beanHints', () => {
  it('says nothing about a bean with nothing to go on', () => {
    expect(beanHints(PLAIN)).toEqual([]);
  });

  it.each([
    [
      { process: 'natural' },
      'Natural process: these often brown faster · consider less heat late in the roast',
    ],
    [
      { process: 'honey' },
      'Honey process: these often brown faster · consider less heat late in the roast',
    ],
    [{ decaf: true }, 'Decaf: often roasts fast and looks dark · judge by temperature'],
    [{ densityGL: 650 }, 'Soft beans (650 g/L): these often run fast · consider less heat early'],
    [
      { densityGL: 820 },
      'Dense beans (820 g/L): these often take heat slowly · consider more heat early',
    ],
    [
      { moisturePct: 12.5 },
      'Moisture 12.5%: these often dry slowly · expect a longer drying phase',
    ],
  ] as const)('%o says why, then its hint', (change, text) => {
    expect(beanHints({ ...PLAIN, ...change })[0]).toBe(text);
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
    expect(hints[0]).toMatch(/^Natural process: /);
    expect(hints[1]).toMatch(/^Decaf: /);
  });
});
