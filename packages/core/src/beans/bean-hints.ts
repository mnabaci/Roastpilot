import type { Bean } from '@roastpilot/shared';

const MAX_HINTS = 2;

/** Starting guesses (docs/spec/beans-favourites-ghost.md, Hints). */
const SOFT_BELOW_G_L = 700;
const DENSE_ABOVE_G_L = 800;
const WET_ABOVE_PCT = 12;

type HintBean = Pick<Bean, 'process' | 'decaf' | 'densityGL' | 'moisturePct'>;

/** Each rule names why it speaks ("Natural process", "Dense beans (820 g/L)"), then the advice. */
const RULES: readonly {
  applies: (bean: HintBean) => boolean;
  why: (bean: HintBean) => string;
  text: string;
}[] = [
  {
    applies: (b) => b.process === 'natural' || b.process === 'honey',
    why: (b) => (b.process === 'honey' ? 'Honey process' : 'Natural process'),
    text: 'these often brown faster · consider less heat late in the roast',
  },
  {
    applies: (b) => b.decaf,
    why: () => 'Decaf',
    text: 'often roasts fast and looks dark · judge by temperature',
  },
  {
    applies: (b) => b.densityGL !== null && b.densityGL < SOFT_BELOW_G_L,
    why: (b) => `Soft beans (${String(b.densityGL)} g/L)`,
    text: 'these often run fast · consider less heat early',
  },
  {
    applies: (b) => b.densityGL !== null && b.densityGL > DENSE_ABOVE_G_L,
    why: (b) => `Dense beans (${String(b.densityGL)} g/L)`,
    text: 'these often take heat slowly · consider more heat early',
  },
  {
    applies: (b) => b.moisturePct !== null && b.moisturePct > WET_ABOVE_PCT,
    why: (b) => `Moisture ${String(b.moisturePct)}%`,
    text: 'these often dry slowly · expect a longer drying phase',
  },
];

/** Advice from what a bean's record says. Never changes a profile. */
export function beanHints(bean: HintBean): string[] {
  return RULES.filter((rule) => rule.applies(bean))
    .slice(0, MAX_HINTS)
    .map((rule) => `${rule.why(bean)}: ${rule.text}`);
}
