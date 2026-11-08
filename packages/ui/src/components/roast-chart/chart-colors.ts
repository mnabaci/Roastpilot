import { TONE_TOKEN, type LineLayer, type ChartMarker } from './chart-layer';

export type ChartTone = LineLayer['tone'] | ChartMarker['tone'];

export interface ChartColors {
  tone: Readonly<Record<ChartTone, string>>;
  axis: string;
  grid: string;
  surface: string;
  font: string;
}

/** uPlot draws on a canvas, so it needs real colours: read them from the token CSS variables. */
export function readChartColors(element: Element): ChartColors {
  const style = getComputedStyle(element);
  const read = (token: string) => style.getPropertyValue(token).trim();
  const tone = Object.fromEntries(
    Object.entries(TONE_TOKEN).map(([name, token]) => [name, read(token)]),
  ) as Record<ChartTone, string>;
  return {
    tone,
    axis: read('--ink-muted'),
    grid: read('--border'),
    surface: read('--surface'),
    font: read('--font-sans') || 'sans-serif',
  };
}
