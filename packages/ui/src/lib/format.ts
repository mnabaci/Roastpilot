/** Seconds as `m:ss` (brand book: `10:18`, never `10m 18s`). Negative before charge: `-1:20`. */
export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const total = Math.floor(Math.abs(seconds));
  const minutes = Math.floor(total / 60);
  return `${sign}${String(minutes)}:${String(total % 60).padStart(2, '0')}`;
}

/** A number with fixed decimals, or undefined when there is nothing to show (StatCard shows a dash). */
export function formatNumber(
  value: number | null | undefined,
  decimals: number,
): string | undefined {
  return value === null || value === undefined || !Number.isFinite(value)
    ? undefined
    : // A value that rounds to zero is 0, never -0.0.
      (Object.is(Number(value.toFixed(decimals)), -0) ? 0 : value).toFixed(decimals);
}
