import type { BeanProcess, BeanSpecies } from '@roastpilot/shared';

/**
 * What a bean's values mean for roasting (docs/spec/beans-favourites-ghost.md, Roast notes), one
 * table for both places it shows: the ⓘ beside a field (`roastNote`) and the Roasting cheat sheet
 * (`ROAST_GUIDE`), so the two never disagree. Each row says what the value is, then how it roasts
 * and what to try, in a line or two; "try" and "often", never an order. The same thresholds as
 * the hints (bean-hints.ts).
 */
type RoastNote = readonly [string, ...string[]];

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

export type NotedField = keyof NotedValues;

interface GuideRow {
  /** Its name: "Natural", "High grown". */
  name: string;
  /** Where its band runs, for a measured value: "1,600 m and up". */
  range?: string;
  /** What it is, after its name: "dried inside the whole fruit, so…". */
  what: string;
  /** How it roasts and what to try: one or two lines. */
  how: readonly [string, ...string[]];
}

interface Row<V> extends GuideRow {
  matches: (value: NonNullable<V>) => boolean;
}

interface GuideSection {
  field: NotedField;
  /** The field's name, as on the bean: "Screen size". */
  title: string;
  rows: readonly GuideRow[];
}

/** Starting guesses, as the hints': revisit once tasted roasts can be compared. */
const SOFT_BELOW_G_L = 700;
const DENSE_ABOVE_G_L = 800;
const WET_ABOVE_PCT = 12;
const DRY_BELOW_PCT = 9;
const HIGH_FROM_M = 1600;
const LOW_BELOW_M = 1200;
const SMALL_UP_TO = 14;
const LARGE_FROM = 17;

const is =
  <V>(wanted: V) =>
  (value: V) =>
    value === wanted;

const SECTIONS: { [F in NotedField]: { title: string; rows: readonly Row<NotedValues[F]>[] } } = {
  process: {
    title: 'Process',
    rows: [
      {
        name: 'Washed',
        what: 'the fruit came off before drying, so the bean is clean and even',
        how: [
          'Takes heat steadily: the most forgiving to learn on.',
          'Try development around 18–22 % for sweetness that keeps its acidity.',
        ],
        matches: is<BeanProcess>('washed'),
      },
      {
        name: 'Natural',
        what: 'dried inside the whole fruit, so the bean carries more sugar',
        how: [
          'Browns sooner, and the outside can scorch before the inside catches up.',
          'Try easing the heat after yellowing and a shorter development, 15–20 %.',
        ],
        matches: is<BeanProcess>('natural'),
      },
      {
        name: 'Honey',
        what: 'dried with some sticky fruit left on, between washed and natural',
        how: [
          'Its sugars brown early and can scorch, the more so the darker the honey.',
          'Try gentler heat from yellowing on, and watch the colour closely.',
        ],
        matches: is<BeanProcess>('honey'),
      },
    ],
  },
  species: {
    title: 'Species',
    rows: [
      {
        name: 'Arabica',
        what: 'most specialty coffee, richer in sugars and acids than Robusta',
        how: ['Rewards a light to medium roast: too dark and roast flavour hides its origin.'],
        matches: is<BeanSpecies>('arabica'),
      },
      {
        name: 'Robusta',
        what: 'dense and low in sugar, with about twice the caffeine',
        how: ['Takes more heat and smokes earlier; a longer development tames its bitterness.'],
        matches: is<BeanSpecies>('robusta'),
      },
      {
        name: 'Liberica',
        what: 'large, uneven beans, smoky and fruity',
        how: ['Uneven sizes roast unevenly: try a gentler, longer roast.'],
        matches: is<BeanSpecies>('liberica'),
      },
      {
        name: 'Excelsa',
        what: 'a Liberica relative, tart and fruity',
        how: ['Often taken a little darker to round off its sharpness: go there gradually.'],
        matches: is<BeanSpecies>('excelsa'),
      },
    ],
  },
  altitudeM: {
    title: 'Altitude',
    rows: [
      {
        name: 'Low grown',
        range: 'Under 1,200 m',
        what: 'usually softer, more open beans',
        how: ['Try a lower charge and gentler heat early, or they run fast.'],
        matches: (m) => m < LOW_BELOW_M,
      },
      {
        name: 'Mid altitude',
        range: '1,200–1,600 m',
        what: 'usually medium density',
        how: ['A balanced start suits it; adjust from how soon it reaches yellowing.'],
        matches: (m) => m >= LOW_BELOW_M && m < HIGH_FROM_M,
      },
      {
        name: 'High grown',
        range: '1,600 m and up',
        what: 'slow-maturing beans, usually dense',
        how: ['They take heat well: try a higher charge and more heat early.'],
        matches: (m) => m >= HIGH_FROM_M,
      },
    ],
  },
  densityGL: {
    title: 'Density',
    rows: [
      {
        name: 'Soft',
        range: 'Under 700 g/L',
        what: 'heat reaches the core fast',
        how: ['Try less heat early, and watch for a rush into first crack.'],
        matches: (gL) => gL < SOFT_BELOW_G_L,
      },
      {
        name: 'Medium',
        range: '700–800 g/L',
        what: 'typical of most specialty beans',
        how: ['A standard profile is a good start.'],
        matches: (gL) => gL >= SOFT_BELOW_G_L && gL <= DENSE_ABOVE_G_L,
      },
      {
        name: 'Dense',
        range: 'Over 800 g/L',
        what: 'heat reaches the core slowly',
        how: ['Try more heat early; easing off too soon can stall the roast.'],
        matches: (gL) => gL > DENSE_ABOVE_G_L,
      },
    ],
  },
  moisturePct: {
    title: 'Moisture',
    rows: [
      {
        name: 'Dry',
        range: 'Under 9 %',
        what: 'drier than usual, often older coffee',
        how: ['It dries quickly and can brown fast: try a little less heat early.'],
        matches: (pct) => pct < DRY_BELOW_PCT,
      },
      {
        name: 'Usual',
        range: '9–12 %',
        what: 'the normal range for green coffee',
        how: ['Nothing to change for it.'],
        matches: (pct) => pct >= DRY_BELOW_PCT && pct <= WET_ABOVE_PCT,
      },
      {
        name: 'Wet',
        range: 'Over 12 %',
        what: 'wetter than usual, often a fresh crop',
        how: ["Expect a longer drying phase; don't rush it with extra heat."],
        matches: (pct) => pct > WET_ABOVE_PCT,
      },
    ],
  },
  screen: {
    title: 'Screen size',
    rows: [
      {
        name: 'Small',
        range: '14 and under',
        what: '14/64 inch, about 5.5 mm, or smaller',
        how: ['They heat through quickly and scorch at the edges sooner: try gentler heat.'],
        matches: (size) => size <= SMALL_UP_TO,
      },
      {
        name: 'Medium',
        range: '15–16',
        what: 'about 6 mm, the most common size',
        how: ['A standard profile is a good start.'],
        matches: (size) => size > SMALL_UP_TO && size < LARGE_FROM,
      },
      {
        name: 'Large',
        range: '17 and up',
        what: 'about 6.7 mm or more',
        how: ['Heat takes longer to reach the core: try a slightly longer roast.'],
        matches: (size) => size >= LARGE_FROM,
      },
    ],
  },
  decaf: {
    title: 'Decaf',
    rows: [
      {
        name: 'Decaf',
        what: 'caffeine taken out before roasting, leaving the bean darker and more open',
        how: ['It roasts fast and looks darker than it is: judge by temperature, not colour.'],
        matches: (decaf) => decaf,
      },
    ],
  },
};

/** The cheat sheet, in the order the bean shows its fields. */
export const ROAST_GUIDE: readonly GuideSection[] = (
  ['process', 'species', 'altitudeM', 'densityGL', 'moisturePct', 'screen', 'decaf'] as const
).map((field) => ({ field, ...SECTIONS[field] }));

/** The row a value falls in, if any: none while it's unset, for Other, or for Decaf No. */
function rowFor<F extends NotedField>(field: F, value: NotedValues[F]): GuideRow | undefined {
  if (value === null) return undefined;
  const rows = SECTIONS[field].rows;
  return rows.find((row) => row.matches(value as NonNullable<NotedValues[F]>));
}

/** Whether a row is the bean's own, for the cheat sheet to mark. */
export const isBeansRow = <F extends NotedField>(
  field: F,
  value: NotedValues[F],
  row: GuideRow,
): boolean => rowFor(field, value) === row;

/** The ⓘ beside a field: its name and what it is, then how it roasts. */
export function roastNote<F extends NotedField>(
  field: F,
  value: NotedValues[F],
): RoastNote | undefined {
  const row = rowFor(field, value);
  return row ? [`${row.name}: ${row.what}.`, ...row.how] : undefined;
}
