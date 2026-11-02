import type { Meta, StoryObj } from '@storybook/react-vite';
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

const meta = {
  title: 'Data/RoastChart',
  component: RoastChart,
  args: {
    title: 'Roast curve',
    layers: [temperature, ror],
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
