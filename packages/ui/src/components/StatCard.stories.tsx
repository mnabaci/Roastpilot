import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatCard } from './StatCard';

const meta = {
  title: 'Data/StatCard',
  component: StatCard,
  args: { label: 'Temperature', value: 198, unit: '°C', context: 'Target 196 °C', tone: 'heat' },
  argTypes: { tone: { control: 'inline-radio', options: ['heat', 'air', 'env', 'ink'] } },
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
/** On a roaster with an ET probe: ET beside the temperature's label. */
export const TemperatureWithEt: Story = {
  args: { secondary: { label: 'ET', value: '212.4', unit: '°C', tone: 'env' } },
};
export const EtNotYetRead: Story = {
  args: { secondary: { label: 'ET', value: undefined, unit: '°C', tone: 'env' } },
};
export const NoValueYet: Story = {
  args: { label: 'Rate of rise', value: null, unit: '°C/min', context: 'Last 30 s', tone: 'air' },
};
