import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SelectField } from './SelectField';

const OPTIONS = [
  { value: 'none', label: 'None' },
  { value: '2', label: 'Mon 2 Nov · 18:20' },
  { value: '1', label: 'Sun 1 Nov · 10:02' },
];

const meta = {
  title: 'Inputs/SelectField',
  component: SelectField<string>,
  args: { label: 'Compare with', value: 'none', options: OPTIONS, onChange: () => undefined },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SelectField {...args} value={value} onChange={setValue} className="w-72" />;
  },
} satisfies Meta<typeof SelectField<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NonePicked: Story = {};
export const Picked: Story = { args: { value: '2' } };
export const Disabled: Story = { args: { disabled: true } };
