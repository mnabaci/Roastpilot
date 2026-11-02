import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatCard } from './StatCard';

const meta = {
  title: 'Data/StatCard',
  component: StatCard,
  args: { label: 'Temperature', value: 198, unit: '°C', context: 'Target 196 °C', tone: 'heat' },
  argTypes: { tone: { control: 'inline-radio', options: ['heat', 'air', 'ink'] } },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Temperature: Story = {};
export const RateOfRise: Story = {
  args: { label: 'Rate of rise', value: '8.6', unit: '°C/min', context: 'Last 30 s', tone: 'air' },
};
export const Development: Story = {
  args: {
    label: 'Development',
    value: '1:12',
    unit: undefined,
    context: '12% of roast',
    tone: 'ink',
  },
};
export const NoValueYet: Story = {
  args: { label: 'Rate of rise', value: null, unit: '°C/min', context: 'Last 30 s', tone: 'air' },
};
