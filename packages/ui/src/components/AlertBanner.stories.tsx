import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AlertBanner } from './AlertBanner';

const meta = {
  title: 'Feedback/AlertBanner',
  component: AlertBanner,
  args: {
    kind: 'critical',
    children: 'Emergency stop · heater off, fan and bean cooler on',
    onDismiss: fn(),
  },
} satisfies Meta<typeof AlertBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critical: Story = {};
export const Warning: Story = {
  args: { kind: 'warning', children: 'Temperature stalled for 60 s · check the roaster' },
};
export const LostConnection: Story = {
  args: { children: 'Roaster disconnected · heater off once it reconnects', onDismiss: undefined },
};
/** Why something waits, not a problem: cyan, as Auto is what runs. */
export const Info: Story = {
  args: {
    kind: 'info',
    children: 'Auto is running this profile · edits save after Drop',
    onDismiss: undefined,
  },
};
export const InfoLight: Story = { ...Info, globals: { theme: 'Light' } };
