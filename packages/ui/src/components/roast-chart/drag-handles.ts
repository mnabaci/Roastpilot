import type uPlot from 'uplot';
import type { ChartColors } from './chart-colors';

/** Points on the temperature axis you can move with the pointer. */
export interface ChartDrag {
  points: readonly { t: number; v: number }[];
  onMove: (index: number, to: { t: number; v: number }) => void;
}

export type TimeRange = readonly [number, number];

const HANDLE_RADIUS_PX = 6;
/** Bigger than the handle, so it's easy to catch. */
const HIT_RADIUS_PX = 14;

export function drawDragHandles(u: uPlot, drag: ChartDrag | undefined, colors: ChartColors): void {
  if (!drag) return;
  const ratio = devicePixelRatio;
  const { ctx } = u;
  ctx.save();
  for (const point of drag.points) {
    ctx.beginPath();
    ctx.arc(
      u.valToPos(point.t, 'x', true),
      u.valToPos(point.v, 'temperature', true),
      HANDLE_RADIUS_PX * ratio,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = colors.tone.target;
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2 * ratio;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The handle within reach of a position in the plot, nearest first. */
export function handleAt(
  points: readonly { x: number; y: number }[],
  x: number,
  y: number,
): number | undefined {
  let found: number | undefined;
  let best = HIT_RADIUS_PX;
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance <= best) {
      best = distance;
      found = index;
    }
  });
  return found;
}

/**
 * Lets the pointer move handles. The listeners live on uPlot's own element, so they go with it.
 * `onStart` gets the time range on screen: the caller holds it until `onEnd`, so the axis doesn't
 * rescale under the pointer.
 */
export function attachDrag(
  u: uPlot,
  {
    drag,
    onStart,
    onEnd,
  }: { drag: () => ChartDrag | undefined; onStart: (range: TimeRange) => void; onEnd: () => void },
): void {
  const { over } = u;
  let active: number | undefined;
  const position = (event: PointerEvent) => {
    const box = over.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - box.left, 0), box.width),
      y: Math.min(Math.max(event.clientY - box.top, 0), box.height),
    };
  };
  const hit = (x: number, y: number) =>
    handleAt(
      (drag()?.points ?? []).map((point) => ({
        x: u.valToPos(point.t, 'x'),
        y: u.valToPos(point.v, 'temperature'),
      })),
      x,
      y,
    );
  const finish = () => {
    if (active === undefined) return;
    active = undefined;
    onEnd();
  };

  over.addEventListener('pointerdown', (event) => {
    const { x, y } = position(event);
    const index = hit(x, y);
    const { min, max } = u.scales.x ?? {};
    if (index === undefined || min === undefined || max === undefined) return;
    event.preventDefault();
    over.setPointerCapture(event.pointerId);
    active = index;
    onStart([min, max]);
  });
  over.addEventListener('pointermove', (event) => {
    const { x, y } = position(event);
    if (active === undefined) {
      over.style.cursor = hit(x, y) === undefined ? '' : 'grab';
      return;
    }
    over.style.cursor = 'grabbing';
    drag()?.onMove(active, { t: u.posToVal(x, 'x'), v: u.posToVal(y, 'temperature') });
  });
  over.addEventListener('pointerup', finish);
  over.addEventListener('pointercancel', finish);
}
