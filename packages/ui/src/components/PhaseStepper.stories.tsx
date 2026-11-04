import type { Meta, StoryObj } from '@storybook/react-vite';
import { PhaseStepper } from './PhaseStepper';

const steps = ['Preheat', 'Roast', 'First crack', 'Drop', 'Cool'];

const meta = {
  title: 'Navigation/PhaseStepper',
  component: PhaseStepper,
  args: { steps, current: 2 },
  argTypes: { current: { control: { type: 'range', min: 0, max: steps.length } } },
} satisfies Meta<typeof PhaseStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstCrack: Story = {};
export const Preheating: Story = { args: { current: 0 } };
export const Finished: Story = { args: { current: steps.length } };
export const WithStageTimes: Story = {
  args: { current: 2, details: ['4:10', '6:20'] },
};
export const DroppedWithoutFirstCrack: Story = {
  args: { current: 4, details: ['4:10', '9:40'], skipped: [2] },
};
