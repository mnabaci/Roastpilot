import { SOAK_LENGTHS_S } from '@roastpilot/shared';
import { formatClock, type SelectOption } from '@roastpilot/ui';

/** The select's value for no soak. */
export const SOAK_OFF = 'off';

/**
 * Off and the lengths a soak can run (docs/spec/ui.md, Profiles screen). A length from elsewhere
 * (a profile made from a roast) is listed too, so it shows as it is until you pick another.
 */
export function soakOptions(currentS: number | null): SelectOption<string>[] {
  const lengths: number[] = [...SOAK_LENGTHS_S];
  if (currentS !== null && !lengths.includes(currentS)) lengths.push(currentS);
  return [
    { value: SOAK_OFF, label: 'Off' },
    ...lengths.sort((a, b) => a - b).map((s) => ({ value: String(s), label: formatClock(s) })),
  ];
}

export const soakValue = (soakS: number | null): string =>
  soakS === null ? SOAK_OFF : String(soakS);

export const soakFromValue = (value: string): number | null =>
  value === SOAK_OFF ? null : Number(value);
