import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompareTable } from './CompareTable';

const meta = {
  title: 'Data/CompareTable',
  component: CompareTable,
  args: {
    otherTitle: 'Mon 2 Nov · 18:20',
    rows: [
      { label: 'Total', own: '9:54', other: '9:00', diff: '+0:54' },
      {
        label: 'Turning point',
        own: '1:32 · 92.4 °C',
        other: '1:27 · 93.4 °C',
        diff: '+0:05 · −1.0 °C',
      },
      { label: 'Dry end', own: '4:30 · 150.0 °C', other: undefined, diff: undefined },
      {
        label: 'First crack',
        own: '8:00 · 196.2 °C',
        other: '7:30 · 195.0 °C',
        diff: '+0:30 · +1.2 °C',
      },
      { label: 'Development', own: '1:54 · 19 %', other: '1:30 · 17 %', diff: '+0:24 · +2 %' },
      { label: 'Drop temp', own: '205.5 °C', other: '206.5 °C', diff: '−1.0 °C' },
      { label: 'Weight loss', own: '14.3 %', other: '13.1 %', diff: '+1.2 %' },
      { label: 'Rating', own: '5', other: '4', diff: '+1', stars: true },
      { label: 'Profile', own: 'Auto · Light · Steps', other: 'Manual', diff: undefined },
      { label: 'Bean', own: 'African Moon', other: 'Ethiopia Guji', diff: undefined },
    ],
  },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof CompareTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** In °F: temperatures whole, a difference ×1.8 with no + 32. */
export const Fahrenheit: Story = {
  args: {
    rows: [
      { label: 'Drop temp', own: '402 °F', other: '404 °F', diff: '−2 °F' },
      {
        label: 'Turning point',
        own: '1:32 · 198 °F',
        other: '1:27 · 200 °F',
        diff: '+0:05 · −2 °F',
      },
    ],
  },
};
