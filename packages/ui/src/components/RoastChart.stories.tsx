import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RoastChart } from './RoastChart';
import type { ChartLayer } from './roast-chart/chart-layer';

/** A plausible Skywalker roast: charge at 180 °C, turnaround near 1:40, first crack at 8:00. */
const seconds = Array.from({ length: 571 }, (_, i) => i - 60);
const temp = (t: number) =>
  t < 0 ? 175 + t / 12 : t < 100 ? 180 - 0.7 * t + 0.0035 * t * t : 115 + (t - 100) * 0.17;
const temperature: ChartLayer = {
  id: 'bt',
  label: 'Temperature',
  axis: 'temperature',
  tone: 'heat',
  width: 3.5,
  points: seconds.map((t) => ({ t, v: temp(t) })),
};
const ror: ChartLayer = {
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
): ChartLayer => ({
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

function DraggablePlan() {
  const [points, setPoints] = useState([
    { t: 90, v: 100 },
    { t: 300, v: 150 },
    { t: 600, v: 200 },
  ]);
  const plan: ChartLayer = {
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
