import type { Bean } from '@roastpilot/shared';

const MAX_HINTS = 2;

/** Starting guesses (docs/spec/beans-favourites-ghost.md, Hints). */
const SOFT_BELOW_G_L = 700;
const DENSE_ABOVE_G_L = 800;
const WET_ABOVE_PCT = 12;

const RULES: readonly {
  applies: (bean: Pick<Bean, 'process' | 'decaf' | 'densityGL' | 'moisturePct'>) => boolean;
  text: string;
}[] = [
  {
    applies: (b) => b.process === 'natural' || b.process === 'honey',
    text: 'These often brown faster · consider less heat late in the roast',
  },
  {
    applies: (b) => b.decaf,
    text: 'Decaf often roasts fast and looks dark · judge by temperature',
  },
  {
    applies: (b) => b.densityGL !== null && b.densityGL < SOFT_BELOW_G_L,
    text: 'Soft beans often run fast · consider less heat early',
  },
  {
    applies: (b) => b.densityGL !== null && b.densityGL > DENSE_ABOVE_G_L,
    text: 'Dense beans often take heat slowly · consider more heat early',
  },
  {
    applies: (b) => b.moisturePct !== null && b.moisturePct > WET_ABOVE_PCT,
    text: 'Wetter beans often dry slowly · expect a longer drying phase',
  },
];

/** Advice from what a bean's record says. Never changes a profile. */
export function beanHints(
  bean: Pick<Bean, 'process' | 'decaf' | 'densityGL' | 'moisturePct'>,
): string[] {
  return RULES.filter((rule) => rule.applies(bean))
    .slice(0, MAX_HINTS)
    .map((rule) => rule.text);
}
