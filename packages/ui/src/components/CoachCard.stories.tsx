import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CoachCard } from './CoachCard';

const meta = {
  title: 'Controls/CoachCard',
  component: CoachCard,
  args: {
    change: 'Heater 65% → 75%',
    reason: '4 °C below target, RoR falling',
    onApply: fn(),
    onDismiss: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CoachCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeatSuggestion: Story = {};
export const NextStep: Story = {
  args: { change: 'Next step at 150 °C', reason: 'Heat 65%, fan 50% (yellowing)' },
};
