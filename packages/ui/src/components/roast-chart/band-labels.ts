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

/** Whether two boxes meet (touching counts). */
export const overlaps = (a: Box, b: Box): boolean =>
  a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

/**
 * Where a band's name goes: the first of its spots (bottom of the band, then its top) that no line
 * passes through and no other label (a marker's) covers; undefined when every spot is taken, so a
 * name never hides a curve or another name.
 */
export function labelSpot(
  spots: readonly Box[],
  lines: readonly CanvasLine[],
  taken: readonly Box[] = [],
): Box | undefined {
  return spots.find(
    (spot) => !crossesAny(spot, lines) && !taken.some((box) => overlaps(spot, box)),
  );
}

/** A band on the canvas, and how wide its name's chip is. */
export interface BandSlot {
  top: number;
  bottom: number;
  width: number;
}

export interface NamePlacement {
  /** Where a chip this wide may start, in order: just right of Charge, then the plot's right edge. */
  lefts: (width: number) => readonly number[];
  /** The chip's height, and the room kept to its band's edges. */
  height: number;
  pad: number;
  /** Every curve drawn, the projection and now line too. */
  lines: readonly CanvasLine[];
  /** The marker labels. */
  taken: readonly Box[];
}

/**
 * Where each band's name goes (docs/design-system RoastChart, Aids): inside its own band,
 * vertically centred in its visible part, else at its top, else its bottom; at the left first,
 * then the right edge. Never over a curve, a marker label or another band's name: a band with no
 * such spot, or too thin for one, gets none (undefined).
 */
export function placeBandNames(
  bands: readonly BandSlot[],
  { lefts, height, pad, lines, taken }: NamePlacement,
): (Box | undefined)[] {
  const placed: Box[] = [];
  return bands.map(({ top, bottom, width }) => {
    const highest = top + pad;
    const lowest = bottom - pad - height;
    if (lowest < highest) return undefined;
    const ys = [(highest + lowest) / 2, highest, lowest];
    const spots = lefts(width).flatMap((left) =>
      ys.map((y) => ({ left, right: left + width, top: y, bottom: y + height })),
    );
    const spot = labelSpot(spots, lines, [...taken, ...placed]);
    if (spot) placed.push(spot);
    return spot;
  });
}
