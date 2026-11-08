import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowDownToLine, Flame, OctagonX } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Actions/Button',
  component: Button,
  args: { onClick: fn(), children: 'Drop now' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', size: 'lg', icon: <Flame />, children: 'Preheat' },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export const Secondary: Story = {
  args: { variant: 'secondary', icon: <ArrowDownToLine />, children: 'Drop now' },
};

/** Closes a card: the coach's Dismiss, the finished roast's Done. */
export const Outline: Story = { args: { variant: 'outline', size: 'sm', children: 'Dismiss' } };

export const Ghost: Story = { args: { variant: 'ghost', children: 'Dismiss' } };

export const Danger: Story = {
  args: { variant: 'danger', icon: <OctagonX />, children: 'Emergency stop' },
};

export const Disabled: Story = {
  args: { variant: 'secondary', disabled: true, children: 'Heating…' },
};
