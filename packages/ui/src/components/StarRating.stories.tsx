import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { StarRating } from './StarRating';

const meta = {
  title: 'Data/StarRating',
  component: StarRating,
  args: { value: 4 },
} satisfies Meta<typeof StarRating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Shown: Story = {};
export const NotRated: Story = { args: { value: null } };
export const Picker: Story = {
  render: () => {
    const [value, setValue] = useState<number | null>(3);
    return <StarRating value={value} onChange={setValue} />;
  },
};
