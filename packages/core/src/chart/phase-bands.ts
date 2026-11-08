/** Where drying ends when there is no profile: the built-in profiles' and Artisan's dry end. */
export const DEFAULT_DRY_END_C = 150;

/** The temperatures between the chart's phase bands, °C (docs/spec/ui.md, Phase bands). */
export interface PhaseBandEdges {
  /** Drying below, Maillard above. */
  dryEndC: number;
  /** Maillard below, development above; undefined when there is nothing to expect it from. */
  firstCrackC: number | undefined;
}

/**
 * The phase bands' edges: the profile's dry end and the expected first crack, each replaced by the
 * real temperature once dry end or first crack has happened. With no profile, drying ends at 150 °C;
 * with no expected first crack, Maillard runs to the top until your first-crack tap.
 */
export function phaseBandEdges({
  profileDryEndC,
  expectedFirstCrackC,
  dryEndAtC,
  firstCrackAtC,
}: {
  profileDryEndC: number | undefined;
  expectedFirstCrackC: number | undefined;
  /** BT at the dry-end event, once it happened. */
  dryEndAtC: number | undefined;
  /** BT at your first-crack tap, once it happened. */
  firstCrackAtC: number | undefined;
}): PhaseBandEdges {
  const dryEndC = dryEndAtC ?? profileDryEndC ?? DEFAULT_DRY_END_C;
  const firstCrackC = firstCrackAtC ?? expectedFirstCrackC;
  // A first crack expected at or below dry end (odd saved roasts) would leave no Maillard band.
  return {
    dryEndC,
    firstCrackC: firstCrackC !== undefined && firstCrackC > dryEndC ? firstCrackC : undefined,
  };
}
