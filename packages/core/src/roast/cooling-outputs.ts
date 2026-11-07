import { FILTER_ON, type Outputs } from './roast-outputs';

/** Which coolings run now (docs/spec/manual-mode.md, Outputs while cooling). */
export interface CoolingRunning {
  beans: boolean;
  drum: boolean;
  /** The roaster's tray fan sits under the drum: it stays on while the drum cools. */
  coolerHelpsDrum: boolean;
  /** What the drum gets when on (RoastOptions.drumOn). */
  drumOn: number;
}

/** Heater, fan, bean cooler, drum and filter for what is running; all off when nothing is. */
export function coolingOutputs({ beans, drum, coolerHelpsDrum, drumOn }: CoolingRunning): Outputs {
  const air = beans || drum;
  const cooler = beans || (drum && coolerHelpsDrum);
  return [
    ['heater', 0],
    ['fan', air ? 100 : 0],
    ['cooling', cooler ? 100 : 0],
    ['drum', air ? drumOn : 0],
    ['filter', beans ? FILTER_ON : 0],
  ];
}
