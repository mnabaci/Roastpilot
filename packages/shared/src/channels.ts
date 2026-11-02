/** Something a driver reads, such as bean temperature. Values are in °C. */
export interface SensorChannel {
  id: string;
  kind: 'sensor';
  unit: 'celsius';
}

/** Something a driver controls. Values are clamped to [min, max] and rounded to `step`. */
export interface OutputChannel {
  id: string;
  kind: 'output';
  unit: 'percent' | 'on-off';
  min: number;
  max: number;
  step: number;
}

export type Channel = SensorChannel | OutputChannel;

/** One poll of the roaster: a value per channel id, taken at `atMs` on the driver's clock. */
export interface Reading {
  atMs: number;
  values: Record<string, number>;
}
