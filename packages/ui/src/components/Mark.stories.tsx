import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mark } from './Mark';

const meta = {
  title: 'Brand/Mark',
  component: Mark,
} satisfies Meta<typeof Mark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MarkOnly: Story = {};
export const WithName: Story = { args: { withName: true } };
