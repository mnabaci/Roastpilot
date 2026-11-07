import type uPlot from 'uplot';

/** One vertical hover line across the chart and the strip, reporting the time under it. */
export function hoverCursor(onHover: (t: number | undefined) => void): Pick<
  uPlot.Options,
  'cursor'
> & {
  hooks: { setCursor: uPlot.Hooks.Defs['setCursor'][] };
} {
  return {
    cursor: {
      x: true,
      y: false,
      points: { show: false },
      drag: { x: false, y: false, setScale: false },
      sync: { key: 'roast-chart' },
    },
    hooks: {
      setCursor: [
        (u) => {
          const left = u.cursor.left ?? -1;
          onHover(left >= 0 ? u.posToVal(left, 'x') : undefined);
        },
      ],
    },
  };
}
