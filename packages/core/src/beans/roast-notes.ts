import type { BeanProcess, BeanSpecies } from '@roastpilot/shared';

/**
 * What a bean's value means for roasting, behind an ⓘ beside the field (docs/spec/
 * beans-favourites-ghost.md, Roast notes): the first line says what it is, the rest how it roasts
 * and what to try. Two or three short lines, never a wall of text; "try" and "often", never an
 * order. The same thresholds as the hints (bean-hints.ts), so the two never disagree.
 */
type RoastNote = readonly [string, ...string[]];

const PROCESS: Readonly<Partial<Record<BeanProcess, RoastNote>>> = {
  washed: [
    'Washed: the fruit came off before drying, so the bean is clean and even.',
    'Takes heat steadily: the most forgiving to learn on.',
    'Try development around 18–22 % for sweetness that keeps its acidity.',
  ],
  natural: [
    'Natural: dried inside the whole fruit, so the bean carries more sugar.',
    'Browns sooner, and the outside can scorch before the inside catches up.',
    'Try easing the heat after yellowing and a shorter development, 15–20 %.',
  ],
  honey: [
    'Honey: dried with some sticky fruit left on, between washed and natural.',
    'Its sugars brown early and can scorch, the more so the darker the honey.',
    'Try gentler heat from yellowing on, and watch the colour closely.',
  ],
};

const SPECIES: Readonly<Partial<Record<BeanSpecies, RoastNote>>> = {
  arabica: [
    'Arabica: most specialty coffee, richer in sugars and acids than Robusta.',
    'Rewards a light to medium roast: too dark and roast flavour hides its origin.',
  ],
  robusta: [
    'Robusta: dense and low in sugar, with about twice the caffeine.',
    'Takes more heat and smokes earlier; a longer development tames its bitterness.',
  ],
  liberica: [
    'Liberica: large, uneven beans, smoky and fruity.',
    'Uneven sizes roast unevenly: try a gentler, longer roast.',
  ],
  excelsa: [
    'Excelsa: a Liberica relative, tart and fruity.',
    'Often taken a little darker to round off its sharpness: go there gradually.',
  ],
};

/** Starting guesses, as the hints': revisit once tasted roasts can be compared. */
const SOFT_BELOW_G_L = 700;
const DENSE_ABOVE_G_L = 800;
const WET_ABOVE_PCT = 12;
const DRY_BELOW_PCT = 9;
const HIGH_FROM_M = 1600;
const LOW_BELOW_M = 1200;
const SMALL_UP_TO = 14;
const LARGE_FROM = 17;

const altitude = (m: number): RoastNote =>
  m >= HIGH_FROM_M
    ? [
        'High grown: slow-maturing beans, usually dense.',
        'They take heat well: try a higher charge and more heat early.',
      ]
    : m < LOW_BELOW_M
      ? [
          'Low grown: usually softer, more open beans.',
          'Try a lower charge and gentler heat early, or they run fast.',
        ]
      : [
          'Mid altitude: usually medium density.',
          'A balanced start suits it; adjust from how soon it reaches yellowing.',
        ];

const density = (gL: number): RoastNote =>
  gL > DENSE_ABOVE_G_L
    ? [
        'Dense: heat reaches the core slowly.',
        'Try more heat early; easing off too soon can stall the roast.',
      ]
    : gL < SOFT_BELOW_G_L
      ? [
          'Soft: heat reaches the core fast.',
          'Try less heat early, and watch for a rush into first crack.',
        ]
      : ['Medium density: typical of most specialty beans.', 'A standard profile is a good start.'];

const moisture = (pct: number): RoastNote =>
  pct > WET_ABOVE_PCT
    ? [
        'Wetter than usual, often a fresh crop.',
        "Expect a longer drying phase; don't rush it with extra heat.",
      ]
    : pct < DRY_BELOW_PCT
      ? [
          'Drier than usual, often older coffee.',
          'It dries quickly and can brown fast: try a little less heat early.',
        ]
      : ['The usual range for green coffee, 9–12 %.', 'Nothing to change for it.'];

const screen = (size: number): RoastNote =>
  size <= SMALL_UP_TO
    ? [
        'Small beans: screen 14 is 14/64 inch, about 5.5 mm.',
        'They heat through quickly and scorch at the edges sooner: try gentler heat.',
      ]
    : size >= LARGE_FROM
      ? [
          'Large beans: screen 17 and up, about 6.7 mm or more.',
          'Heat takes longer to reach the core: try a slightly longer roast.',
        ]
      : [
          'Medium beans: screen 15–16, about 6 mm, the most common size.',
          'A standard profile is a good start.',
        ];

const DECAF: RoastNote = [
  'Decaf: caffeine taken out before roasting, leaving the bean darker and more open.',
  'It roasts fast and looks darker than it is: judge by temperature, not colour.',
];

/** A bean's values that have a roast note; anything left out has none. */
export interface NotedValues {
  process: BeanProcess;
  species: BeanSpecies | null;
  altitudeM: number | null;
  densityGL: number | null;
  moisturePct: number | null;
  screen: number | null;
  decaf: boolean;
}

/** The roast note for one field's value; none for a value with nothing to say (unset, Other). */
export function roastNote<K extends keyof NotedValues>(
  field: K,
  value: NotedValues[K],
): RoastNote | undefined {
  if (value === null) return undefined;
  switch (field) {
    case 'process':
      return PROCESS[value as BeanProcess];
    case 'species':
      return SPECIES[value as BeanSpecies];
    case 'altitudeM':
      return altitude(value as number);
    case 'densityGL':
      return density(value as number);
    case 'moisturePct':
      return moisture(value as number);
    case 'screen':
      return screen(value as number);
    case 'decaf':
      return value ? DECAF : undefined;
  }
  return undefined;
}
