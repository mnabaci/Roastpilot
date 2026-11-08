import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RoastChart } from './RoastChart';
import type { ChartAid, LineLayer } from './roast-chart/chart-layer';

/** A plausible Skywalker roast: charge at 180 °C, turnaround near 1:40, first crack at 8:00. */
const seconds = Array.from({ length: 571 }, (_, i) => i - 60);
const temp = (t: number) =>
  t < 0 ? 175 + t / 12 : t < 100 ? 180 - 0.7 * t + 0.0035 * t * t : 115 + (t - 100) * 0.17;
const temperature: LineLayer = {
  id: 'bt',
  label: 'Temperature',
  axis: 'temperature',
  tone: 'heat',
  width: 3.5,
  points: seconds.map((t) => ({ t, v: temp(t) })),
};
const ror: LineLayer = {
  id: 'ror',
  label: 'RoR',
  axis: 'ror',
  tone: 'air',
  width: 2,
  points: seconds.filter((t) => t > 30).map((t) => ({ t, v: Math.max(0, 18 - t / 40) })),
};

/** Heater 100 % until 3:00, then 80, 60 after first crack; fan 30 → 50 → 70. */
const step = (
  id: string,
  label: string,
  tone: 'heat' | 'air',
  changes: [number, number][],
): LineLayer => ({
  id,
  label,
  axis: 'output',
  tone,
  width: 2,
  step: true,
  points: seconds.map((t) => ({
    t,
    v: changes.filter(([at]) => at <= t).at(-1)?.[1] ?? 0,
  })),
});
const heater = step('heater', 'Heater', 'heat', [
  [-60, 100],
  [180, 80],
  [480, 60],
]);
const fan = step('fan', 'Fan', 'air', [
  [-60, 30],
  [240, 50],
  [420, 70],
]);

const meta = {
  title: 'Data/RoastChart',
  component: RoastChart,
  args: {
    title: 'Roast curve',
    layers: [temperature, ror, heater, fan],
    markers: [
      { id: 'charge', label: 'Charge', t: 0, tone: 'ink' },
      { id: 'fc', label: 'First crack', t: 480, tone: 'ink' },
    ],
  },
} satisfies Meta<typeof RoastChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};
export const BeforeCharge: Story = {
  args: { layers: [{ ...temperature, points: temperature.points.slice(0, 40) }], markers: [] },
};
export const NoReadings: Story = {
  args: { layers: [{ ...temperature, points: [] }], markers: [] },
};
export const WithoutOutputs: Story = { args: { layers: [temperature, ror] } };

/** During a roast (docs/spec/ui.md, Chart): now is the last reading, 8:30. */
const NOW_S = 510;
const nowLine: ChartAid = { kind: 'now-line', id: 'now', t: NOW_S };
const projection: ChartAid = {
  kind: 'projection',
  id: 'projection',
  axis: 'temperature',
  tone: 'heat',
  // 2:00 at the last RoR, 5.3 °C/min.
  points: [
    { t: NOW_S, v: temp(NOW_S) },
    { t: NOW_S + 120, v: temp(NOW_S) + 5.25 * 2 },
  ],
};
const phaseBands: ChartAid = {
  kind: 'phase-bands',
  id: 'phases',
  bands: [
    { label: 'Drying', toC: 150 },
    { label: 'Maillard', fromC: 150, toC: 192 },
    { label: 'Development', fromC: 192 },
  ],
};
const roastWindow = { fromS: -30, toS: 736 };
const roasting = { timeWindow: roastWindow, temperatureFloorC: 50 };

/** Everything on, as a roast shows it by default. */
export const DuringARoast: Story = {
  args: { ...roasting, layers: [phaseBands, temperature, ror, heater, fan, projection, nowLine] },
};
export const DuringARoastLight: Story = {
  ...DuringARoast,
  globals: { theme: 'Light' },
};
export const PhaseBands: Story = {
  args: { ...roasting, layers: [phaseBands, temperature, ror] },
};
export const PhaseBandsLight: Story = { ...PhaseBands, globals: { theme: 'Light' } };
export const Projection: Story = {
  args: { ...roasting, layers: [temperature, ror, projection] },
};
export const ProjectionLight: Story = { ...Projection, globals: { theme: 'Light' } };
export const NowLine: Story = {
  args: { ...roasting, layers: [temperature, ror, heater, fan, nowLine] },
};
export const NowLineLight: Story = { ...NowLine, globals: { theme: 'Light' } };
/** Temperature focus on, the other aids off: the axis runs 50–250 °C. */
export const TemperatureFocus: Story = { args: { ...roasting, layers: [temperature, ror] } };
export const TemperatureFocusLight: Story = { ...TemperatureFocus, globals: { theme: 'Light' } };
/** The same roast with every aid off: the whole recording, 0–250 °C. */
export const AidsOff: Story = { args: { layers: [temperature, ror, heater, fan] } };

function DraggablePlan() {
  const [points, setPoints] = useState([
    { t: 90, v: 100 },
    { t: 300, v: 150 },
    { t: 600, v: 200 },
  ]);
  const plan: LineLayer = {
    id: 'plan',
    label: 'Plan',
    axis: 'temperature',
    tone: 'target',
    width: 2,
    dash: [6, 6],
    points: [{ t: 0, v: 180 }, ...points],
  };
  return (
    <RoastChart
      title="Preview"
      height={280}
      layers={[plan]}
      drag={{
        points,
        onMove: (index, to) => {
          setPoints(points.map((point, i) => (i === index ? to : point)));
        },
      }}
    />
  );
}

export const DraggablePoints: Story = { render: () => <DraggablePlan /> };
