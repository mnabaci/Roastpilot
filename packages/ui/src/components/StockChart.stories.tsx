import type { Meta, StoryObj } from '@storybook/react-vite';
import { StockChart, type StockPoint } from './StockChart';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-09T12:00:00Z');
const grams = (g: number) => `${Math.round(g).toLocaleString('en-GB')} g`;
const at = (daysAgo: number) => NOW - daysAgo * DAY_MS;
const day = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const point = (daysAgo: number, valueG: number, what: string): StockPoint => ({
  atMs: at(daysAgo),
  valueG,
  date: day(at(daysAgo)),
  what,
});

const meta = {
  title: 'Data/StockChart',
  component: StockChart,
  args: {
    label: 'Green stock from 2,000 g to 1,180 g since 12 Sept',
    nowMs: NOW,
    lowG: 500,
    formatGrams: grams,
    points: [
      point(58, 2000, 'Bought · +2,000 g'),
      point(52, 1640, 'Roasted · −360 g'),
      point(45, 1280, 'Roasted · −360 g'),
      point(38, 920, 'Roasted · −360 g'),
      point(30, 560, 'Roasted · −360 g'),
      point(26, 2560, 'Bought · +2,000 g'),
      point(20, 2200, 'Roasted · −360 g'),
      point(14, 1840, 'Roasted · −360 g'),
      point(12, 1900, 'Counted · +60 g'),
      point(5, 1540, 'Roasted · −360 g'),
      point(2, 1180, 'Roasted · −360 g'),
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl rounded-xl bg-surface p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StockChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoLowStockLine: Story = { args: { lowG: 0 } };
export const OnePurchase: Story = {
  args: { label: 'Green stock 1,000 g', points: [point(3, 1000, 'Bought · +1,000 g')] },
};
