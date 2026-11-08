import type { Box } from './band-labels';

/**
 * The now line's pieces from `top` to `bottom` at `x`: it breaks under each marker label it would
 * cross, `room` pixels clear of it, so the label stays readable (docs/spec/ui.md, Now line).
 */
export function nowLineSegments(
  x: number,
  top: number,
  bottom: number,
  labels: readonly Box[],
  room: number,
): [number, number][] {
  const gaps = labels
    .filter((box) => box.left <= x && x <= box.right)
    .map((box) => [box.top - room, box.bottom + room] as const)
    .sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let from = top;
  for (const [start, end] of gaps) {
    if (start > from) segments.push([from, Math.min(start, bottom)]);
    from = Math.max(from, end);
    if (from >= bottom) return segments;
  }
  segments.push([from, bottom]);
  return segments;
}
