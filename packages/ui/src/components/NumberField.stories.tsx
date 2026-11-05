import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { NumberField } from './NumberField';

const meta = {
  title: 'Inputs/NumberField',
  component: NumberField,
  args: { label: 'Charge temp', value: '180', unit: '°C', onChange: () => undefined },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <NumberField {...args} value={value} onChange={setValue} className="w-40" />;
  },
} satisfies Meta<typeof NumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Time: Story = { args: { label: 'Duration', value: '4:05', unit: undefined } };
export const HiddenLabel: Story = { args: { hideLabel: true } };
export const Invalid: Story = {
  args: { label: 'BT cap', value: '300', invalid: true, hint: 'At most 235 °C' },
};
export const Disabled: Story = { args: { disabled: true } };
