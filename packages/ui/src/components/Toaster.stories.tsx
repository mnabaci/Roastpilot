import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Toaster } from './Toaster';

const meta = {
  title: 'Feedback/Toaster',
  component: Toaster,
  args: {
    toasts: [{ id: '1', kind: 'error', text: "Couldn't delete the roast · try again" }],
    onDismiss: fn(),
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Failure: Story = {};
export const Success: Story = {
  args: { toasts: [{ id: '1', kind: 'success', text: 'Copied' }] },
};
export const Info: Story = {
  args: { toasts: [{ id: '1', kind: 'info', text: 'Settings kept for this session' }] },
};
export const Stacked: Story = {
  args: {
    toasts: [
      { id: '1', kind: 'success', text: 'Copied' },
      { id: '2', kind: 'error', text: "Couldn't open the log folder · try again" },
      { id: '3', kind: 'error', text: "Couldn't delete the roast · try again" },
      { id: '4', kind: 'error', text: "Couldn't save settings · try again" },
    ],
  },
};
export const LongText: Story = {
  args: {
    toasts: [
      {
        id: '1',
        kind: 'error',
        text: "Couldn't copy the profile to Skywalker V2 in the garage · try again",
      },
    ],
  },
};
