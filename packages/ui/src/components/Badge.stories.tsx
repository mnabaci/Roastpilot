import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Feedback/Badge',
  component: Badge,
  args: { children: 'Auto', tone: 'air' },
  argTypes: { tone: { control: 'inline-radio', options: ['air', 'heat', 'neutral'] } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Auto: Story = {};
export const Manual: Story = { args: { tone: 'heat', children: 'Manual' } };
export const BuiltIn: Story = { args: { tone: 'neutral', children: 'Built-in' } };
