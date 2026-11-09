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
 * are all line layers; a roaster with extra probes adds layers, not chart code.
 */
export interface LineLayer {
  /** A layer without a kind is a line. */
  kind?: 'line';
  id: string;
  label: string;
  /**
   * Left axis (°C), the right axis (RoR, °C/min), or `output` (0–100 %) in the strip under the
   * chart. Values come in °C; the chart shows them in its `temperatureUnit`.
   */
  axis: 'temperature' | 'ror' | 'output';
  /** `neutral`: the drum, neither heat nor air (docs/spec/ui.md, Outputs). */
  tone: 'heat' | 'air' | 'neutral' | 'target' | 'ghost';
  /** Line width in px (design system: live 3.5, others 2). */
  width: number;
  /** Dash pattern in px, e.g. [6, 6] for the target. */
  dash?: readonly number[];
  /** Holds each value until the next point (outputs change in steps). */
  step?: boolean;
  /** Drawn faded, 0–1 (a compared roast's outputs: 0.55, like the projection). */
  opacity?: number;
  /**
   * Another roast's line drawn to compare with the layer of this id (History's Compare): the
   * legend shows its value after that layer's ("Heater 45% · compared 50%") instead of its own
   * entry. Listed on its own when that layer isn't there.
   */
  compareOf?: string;
  points: readonly ChartPoint[];
}

/** A faint vertical line at the current time, through the chart and the outputs strip. */
export interface NowLineLayer {
  kind: 'now-line';
  id: string;
  t: number;
}

/** Where a line is heading: a faint dashed continuation, in that line's colour. */
export interface ProjectionLayer {
  kind: 'projection';
  id: string;
  axis: 'temperature' | 'ror';
  tone: LineLayer['tone'];
  points: readonly ChartPoint[];
}

/** One temperature band; a missing edge runs to the axis's end. */
export interface PhaseBand {
  label: string;
  fromC?: number;
  toC?: number;
}

/** Faint full-width bands behind the curves, coolest first, each named once at its left edge. */
export interface PhaseBandsLayer {
  kind: 'phase-bands';
  id: string;
  bands: readonly PhaseBand[];
}

/** What the chart draws over or behind the lines: no legend entry, no hover value. */
export type ChartAid = NowLineLayer | ProjectionLayer | PhaseBandsLayer;

/** Everything RoastChart draws from its `layers`: lines and aids (docs/spec/extensibility.md). */
export type ChartLayer = LineLayer | ChartAid;

export const isLineLayer = (layer: ChartLayer): layer is LineLayer =>
  layer.kind === undefined || layer.kind === 'line';

/** A labelled vertical line: Charge, First crack, Drop. */
export interface ChartMarker {
  id: string;
  label: string;
  t: number;
  tone: 'ink' | 'ghost';
}

/** The token each tone draws with. */
export const TONE_TOKEN: Readonly<Record<LineLayer['tone'] | ChartMarker['tone'], string>> = {
  heat: '--heat',
  air: '--air',
  neutral: '--ink-muted',
  target: '--target',
  ghost: '--ghost',
  ink: '--ink',
};
