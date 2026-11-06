import type { Meta, StoryObj } from '@storybook/react-vite';
import { OctagonX } from 'lucide-react';
import { Button } from './Button';
import { ErrorState } from './ErrorState';

const meta = {
  title: 'Feedback/ErrorState',
  component: ErrorState,
  args: {
    title: 'Settings hit a problem',
    detail: "Cannot read properties of undefined (reading 'subscribe')",
    onReload: () => undefined,
    onOpenLogs: () => undefined,
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Screen: Story = {};
export const WholeWindow: Story = {
  args: {
    title: 'Roastpilot hit a problem',
    before: (
      <Button variant="danger" icon={<OctagonX aria-hidden="true" />}>
        Emergency stop
      </Button>
    ),
  },
};
export const NoDetail: Story = { args: { detail: undefined } };
