/** What the manual flow sends to the roaster in each step (docs/spec/manual-mode.md). */
export type Outputs = readonly (readonly [channel: string, value: number])[];

/**
 * Drum turning and smoke filter fan running from Preheat (or Start) until cooling ends. The filter
 * takes levels 0–4; 1 is what the Artisan configs for this sketch send.
 */
export const FILTER_ON = 1;
export const ROAST_ON: Outputs = [
  ['drum', 1],
  ['filter', FILTER_ON],
];
export const DROP_OUTPUTS: Outputs = [
  ['heater', 0],
  ['fan', 100],
  ['cooling', 100],
];
export const ALL_OFF: Outputs = [
  ['heater', 0],
  ['fan', 0],
  ['cooling', 0],
  ['drum', 0],
  ['filter', 0],
];
/** Roaster cool-down: air through the empty drum; the tray and the smoke filter are done. */
export const ROASTER_COOLING: Outputs = [
  ['heater', 0],
  ['cooling', 0],
  ['filter', 0],
  ['fan', 100],
  ['drum', 1],
];
