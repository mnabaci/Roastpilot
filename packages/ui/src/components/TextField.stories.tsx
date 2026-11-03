import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TextField } from './TextField';

const meta = {
  title: 'Inputs/TextField',
  component: TextField,
  args: {
    label: 'Search',
    type: 'search',
    value: '',
    placeholder: 'Event, scope or context',
    onChange: () => undefined,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TextField {...args} value={value} onChange={setValue} className="w-80" />;
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchEmpty: Story = {};
export const SearchFilled: Story = { args: { value: 'connect-failed' } };
export const Text: Story = {
  args: { label: 'Bean', type: 'text', value: 'Kenya AA', placeholder: undefined },
};
export const Disabled: Story = { args: { disabled: true } };
