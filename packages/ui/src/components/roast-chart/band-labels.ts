/** A box on the canvas, in device pixels. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A drawn line on the canvas: its points in order, null where it breaks. */
export type CanvasLine = readonly ({ x: number; y: number } | null)[];

/** Whether a segment's bounding box meets the box: cautious, so a label never sits on a line. */
const segmentMeets = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Box,
): boolean =>
  Math.max(a.x, b.x) >= box.left &&
  Math.min(a.x, b.x) <= box.right &&
  Math.max(a.y, b.y) >= box.top &&
  Math.min(a.y, b.y) <= box.bottom;

/** Whether any line passes through the box (a lone point counts too). */
export function crossesAny(box: Box, lines: readonly CanvasLine[]): boolean {
  return lines.some((line) =>
    line.some((point, i) => {
      if (!point) return false;
      const next = line[i + 1] ?? point;
      return segmentMeets(point, next, box);
    }),
  );
}

/**
 * Where a band's name goes: the first of its spots (bottom of the band, then its top) that no line
 * passes through; undefined when every spot is taken, so a name never hides a curve.
 */
export function labelSpot(spots: readonly Box[], lines: readonly CanvasLine[]): Box | undefined {
  return spots.find((spot) => !crossesAny(spot, lines));
}
