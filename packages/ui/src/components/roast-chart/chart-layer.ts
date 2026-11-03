/** A point on the chart: seconds since charge (negative during preheat) and a value. */
export interface ChartPoint {
  t: number;
  v: number;
}

/**
 * One series on the RoastChart (design system: RoastChart). Live temperature, RoR, target and ghost
 * are all layers; a roaster with extra probes adds layers, not chart code.
 */
export interface ChartLayer {
  id: string;
  label: string;
  /** Left axis in °C, or the right axis in °C/min. */
  axis: 'temperature' | 'ror';
  tone: 'heat' | 'air' | 'target' | 'ghost';
  /** Line width in px (design system: live 3.5, others 2). */
  width: number;
  /** Dash pattern in px, e.g. [6, 6] for the target. */
  dash?: readonly number[];
  points: readonly ChartPoint[];
}

/** A labelled vertical line: Charge, First crack, Drop. */
export interface ChartMarker {
  id: string;
  label: string;
  t: number;
  tone: 'ink' | 'ghost';
}

/** The token each tone draws with. */
export const TONE_TOKEN: Readonly<Record<ChartLayer['tone'] | ChartMarker['tone'], string>> = {
  heat: '--heat',
  air: '--air',
  target: '--target',
  ghost: '--ghost',
  ink: '--ink',
};
