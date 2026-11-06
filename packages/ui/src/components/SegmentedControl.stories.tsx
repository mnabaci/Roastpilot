import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

const meta = {
  title: 'Inputs/SegmentedControl',
  component: SegmentedControl,
  args: {
    label: 'Cooling ends',
    options: [
      { value: 'time', label: 'By time' },
      { value: 'temperature', label: 'By temperature' },
    ],
    value: 'time',
    onChange: () => undefined,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof SegmentedControl<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoOptions: Story = {};
export const SixTimes: Story = {
  args: {
    label: 'Soak time',
    options: ['0:30', '0:45', '1:00', '1:15', '1:30', '2:00'].map((t) => ({ value: t, label: t })),
    value: '1:00',
  },
};
export const Disabled: Story = { args: { disabled: true } };
