import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Feedback/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    onOpenChange: () => undefined,
    question: 'Delete this roast?',
    detail: "can't be undone",
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Delete: Story = {};
export const EndRoast: Story = {
  args: {
    question: 'End the roast?',
    detail: 'everything turns off',
    confirmLabel: 'End roast',
    destructive: false,
  },
};
