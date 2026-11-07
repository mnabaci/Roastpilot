import type { Channel } from '@roastpilot/shared';

/** What the manual flow sends to the roaster in each step (docs/spec/manual-mode.md). */
export type Outputs = readonly (readonly [channel: string, value: number])[];

/**
 * Drum turning and smoke filter fan running from Preheat (or Start) until bean cooling ends. The filter
 * takes levels 0–4; 1 is what the Artisan configs for this sketch send.
 */
export const FILTER_ON = 1;
/** What an on/off drum takes for on; a drum with a speed takes its roaster's usual speed. */
export const DRUM_ON = 1;

/**
 * What the drum gets when the app turns it on, from the connected roaster's drum: the usual speed
 * when it has one, else on (docs/spec/roasters.md, Drum speed).
 */
export function drumOnValue(channels: readonly Channel[], usualPct: number): number {
  const drum = channels.find((c) => c.id === 'drum');
  return drum?.kind === 'output' && drum.unit === 'percent' ? usualPct : DRUM_ON;
}
/** Drum turning and filter fan running, the drum at `drumOn`. */
export function roastOn(drumOn: number): Outputs {
  return [
    ['drum', drumOn],
    ['filter', FILTER_ON],
  ];
}
export const ALL_OFF: Outputs = [
  ['heater', 0],
  ['fan', 0],
  ['cooling', 0],
  ['drum', 0],
  ['filter', 0],
];
