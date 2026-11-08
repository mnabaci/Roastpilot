import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleStop } from 'lucide-react';
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
    question: 'Stop the roast?',
    consequences: [
      'Heater, fan, drum and filter off now',
      'No bean cooling · dump the beans yourself',
      'The roast is saved as stopped',
    ],
    cancelLabel: 'Keep roasting',
    confirmLabel: 'Stop roast',
    icon: <CircleStop />,
    destructive: false,
    caution: true,
  },
};
