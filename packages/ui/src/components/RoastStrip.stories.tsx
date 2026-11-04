import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoastStrip } from './RoastStrip';

const meta = {
  title: 'Navigation/RoastStrip',
  component: RoastStrip,
  args: {
    lead: 'Roasting · 7:42',
    onOpen: () => undefined,
    numbers: [
      { label: 'Temp', value: '182.4 °C' },
      { label: 'RoR', value: '8.1' },
      { label: 'Heater', value: '60 %' },
      { label: 'Fan', value: '40 %' },
    ],
  },
} satisfies Meta<typeof RoastStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Quiet: Story = {};
export const NeedsYou: Story = {
  args: {
    lead: 'Cooling · 0:02',
    prompt: 'Dump beans · Cooling 3:58 left',
    numbers: [{ label: 'Temp', value: '196.2 °C' }],
  },
};
export const MissingValues: Story = {
  args: {
    numbers: [
      { label: 'Temp', value: undefined },
      { label: 'RoR', value: undefined },
    ],
  },
};
