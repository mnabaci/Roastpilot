import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Feedback/Tooltip',
  component: Tooltip,
  args: {
    content: 'African Moon · Auto · Light · Steps · 5/5',
    children: <Button size="sm">Rest the pointer here, or tab to it</Button>,
  },
  decorators: [(Story) => <div className="p-6">{Story()}</div>],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Long: Story = {
  args: {
    content:
      'Ethiopia Yirgacheffe Kochere Washed Grade 1 · Auto · Light · Steps (from Simulator) · 4/5',
  },
};
/** Near the window's right edge it shifts left to stay on screen. */
export const AtTheEdge: Story = {
  decorators: [(Story) => <div className="flex justify-end p-6">{Story()}</div>],
};
