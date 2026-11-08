/** A cell of the steps table; the gap between fields halves below 1280 px, where room is short. */
export const CELL = 'px-0.5 py-1 align-middle xl:px-1';

/** A value you can't edit, its text in line with the text of the fields under it. */
export const FIXED = `${CELL} text-body text-ink-muted [&>span]:block [&>span]:border [&>span]:border-transparent [&>span]:px-2.5`;

/** A cell holding one icon button (the handle, Remove): the button's own room is its gap. */
export const BUTTON_CELL = 'py-1 align-middle';

/**
 * The narrowest a field gets in a tight window, so its value still shows whole: times ("11:00")
 * need the most, three digits (an end temp, 100 % fan) more than a two-digit RoR.
 */
export const FIELD_MIN: Readonly<Record<string, string>> = {
  time: 'min-w-18',
  backup: 'min-w-18',
  rorMin: 'min-w-11',
  rorMax: 'min-w-11',
};
export const FIELD_MIN_DEFAULT = 'min-w-13';
