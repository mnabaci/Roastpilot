import { formatGrams } from './batch-format';
import { today } from './stock-date';

export const FAILED = "Couldn't save the stock · see Logs";

/** The day to save: left out when it is today, so the change keeps its time. */
export const adjustedOn = (day: string): string | undefined =>
  day.trim() === today() ? undefined : day.trim();

/** What a count changes: "84 g less than the app had", before it is saved. */
export function recountChange(countedG: number, hadG: number): string {
  const diff = countedG - hadG;
  if (diff === 0) return 'Same as the app has';
  return `${formatGrams(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} than the app had`;
}
