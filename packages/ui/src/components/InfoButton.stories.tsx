import type { Meta, StoryObj } from '@storybook/react-vite';
import { InfoButton } from './InfoButton';

const meta = {
  title: 'Feedback/InfoButton',
  component: InfoButton,
  args: {
    label: 'About tasting words',
    lines: [
      'Write how a roast tasted, like “tart, a bit hay-like”. Read ticks the taste tags that match, and the tags suggest what to change in the next roast.',
      'Where: History › a roast › Roast details › Taste › In your words.',
      'Sends only those words, up to 500 characters.',
    ],
  },
  render: (args) => (
    <div className="flex items-center gap-1">
      <h3 className="text-body font-semibold">Tasting words</h3>
      <InfoButton {...args} />
    </div>
  ),
} satisfies Meta<typeof InfoButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BesideAName: Story = {};
export const BesideANameLight: Story = { globals: { theme: 'Light' } };
