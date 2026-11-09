import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { RoastList } from './RoastList';

const meta = {
  title: 'Data/RoastList',
  component: RoastList,
  args: {
    label: 'Saved roasts',
    selectedId: 3,
    onSelect: () => undefined,
    items: [
      {
        id: 3,
        title: 'Wed 4 Nov · 14:32',
        numbers: '9:40 · FC 8:00 · 205.5 °C',
        detail: ['Yirgacheffe', 'Auto · Light · Steps'],
        rating: 4,
        favourite: true,
      },
      { id: 2, title: 'Wed 4 Nov · 11:05', numbers: '4:12', badge: 'Unfinished' },
      { id: 1, title: 'Mon 2 Nov · 18:20', numbers: '10:18 · FC 8:41 · 208.0 °C' },
    ],
  },
  render: function Render(args) {
    const [selected, setSelected] = useState(args.selectedId);
    return <RoastList {...args} selectedId={selected} onSelect={setSelected} className="w-72" />;
  },
} satisfies Meta<typeof RoastList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** A long bean name gives way first, so how it ran stays readable; rest on the row for all of it. */
export const LongBeanName: Story = {
  args: {
    items: [
      {
        id: 3,
        title: 'Wed 4 Nov · 14:32',
        numbers: '9:40 · FC 8:00 · 205.5 °C',
        detail: ['Ethiopia Yirgacheffe Kochere Washed', 'Auto · Light · Steps'],
        rating: 5,
      },
      {
        id: 2,
        title: 'Wed 4 Nov · 11:05',
        numbers: '10:02 · FC 8:31 · 207.0 °C',
        detail: ['African Moon', 'Auto · Third crack hunting (from Simulator)'],
        rating: 3,
      },
    ],
  },
};
export const NothingSelected: Story = { args: { selectedId: undefined } };
export const Long: Story = {
  args: {
    items: Array.from({ length: 30 }, (_, i) => ({
      id: 30 - i,
      title: `Day ${String(30 - i)} Nov · 09:00`,
      numbers: '9:40 · FC 8:00 · 205.5 °C',
    })),
  },
  decorators: [(Story) => <div className="flex h-96 flex-col">{Story()}</div>],
};
