import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FilterSelect } from './FilterSelect';

const meta = {
  title: 'Inputs/FilterSelect',
  component: FilterSelect,
  args: {
    label: 'Bean',
    options: [
      { value: 'all', label: 'All' },
      { value: '1', label: 'Ethiopia Guji' },
      { value: '2', label: 'Colombia Huila' },
    ],
    value: 'all',
    allValue: 'all',
    onChange: () => undefined,
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-40">
        <FilterSelect {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof FilterSelect<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {};
export const Filtering: Story = { args: { value: '1' } };
