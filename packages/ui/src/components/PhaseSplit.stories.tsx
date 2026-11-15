import type { Meta, StoryObj } from '@storybook/react-vite';
import { PhaseSplit } from './PhaseSplit';

const meta = {
  title: 'Data/PhaseSplit',
  component: PhaseSplit,
  args: {
    parts: [
      {
        key: 'drying',
        label: 'Drying',
        detail: '4:24 · 40 %',
        end: 'to 150.2 °C',
        share: 0.4,
        tone: 'low',
      },
      {
        key: 'maillard',
        label: 'Maillard',
        detail: '4:36 · 42 %',
        end: 'to 196.0 °C',
        share: 0.42,
        tone: 'mid',
      },
      {
        key: 'development',
        label: 'Development',
        detail: '2:00 · 18 %',
        end: 'to 208.5 °C',
        share: 0.18,
        tone: 'high',
      },
    ],
  },
  render: (args) => (
    <div className="w-[480px] rounded-xl bg-surface p-5">
      <PhaseSplit {...args} />
    </div>
  ),
} satisfies Meta<typeof PhaseSplit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreePhases: Story = {};
export const ThreePhasesLight: Story = { globals: { theme: 'Light' } };
export const NoDryEnd: Story = {
  args: {
    parts: [
      {
        key: 'before-crack',
        label: 'Before first crack',
        detail: '9:00 · 82 %',
        share: 0.82,
        tone: 'low',
      },
      {
        key: 'development',
        label: 'Development',
        detail: '2:00 · 18 %',
        end: 'to 208.5 °C',
        share: 0.18,
        tone: 'high',
      },
    ],
  },
};
