/**
 * A point on the chart: seconds since charge (negative during preheat) and a value. A null value
 * is a break: the line stops there instead of joining across missing readings.
 */
export interface ChartPoint {
  t: number;
  v: number | null;
}

/**
 * One series on the RoastChart (design system: RoastChart). Live temperature, RoR, target and ghost
 * are all layers; a roaster with extra probes adds layers, not chart code.
 */
export interface ChartLayer {
  id: string;
  label: string;
  /** Left axis in °C, the right axis in °C/min, or `output` (0–100 %) in the strip under the chart. */
  axis: 'temperature' | 'ror' | 'output';
  /** `neutral`: the drum, neither heat nor air (docs/spec/ui.md, Outputs). */
  tone: 'heat' | 'air' | 'neutral' | 'target' | 'ghost';
  /** Line width in px (design system: live 3.5, others 2). */
  width: number;
  /** Dash pattern in px, e.g. [6, 6] for the target. */
  dash?: readonly number[];
  /** Holds each value until the next point (outputs change in steps). */
  step?: boolean;
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
  neutral: '--ink-muted',
  target: '--target',
  ghost: '--ghost',
  ink: '--ink',
};
