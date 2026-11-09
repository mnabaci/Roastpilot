import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoastTable } from './RoastTable';

const meta = {
  title: 'Data/RoastTable',
  component: RoastTable,
  args: {
    label: 'Roasts of African Moon',
    className: 'w-3xl',
    rows: [
      {
        id: 17,
        title: 'Sun 8 Nov · 16:45',
        favourite: true,
        ran: 'Auto · Light · Curve (356gr)',
        time: '10:20',
        fc: '8:34',
        drop: '197.0 °C',
        weights: '356 → 305 g',
        loss: '14.3 %',
        rating: 5,
      },
      {
        id: 16,
        title: 'Sun 8 Nov · 16:15',
        ran: 'Auto · Light · Steps(356gr)',
        time: '11:14',
        fc: '9:29',
        drop: '198.0 °C',
        weights: '356 → 304 g',
        loss: '14.6 %',
        rating: undefined,
      },
      {
        id: 7,
        title: 'Wed 4 Nov · 17:37',
        ran: 'Manual',
        time: '11:02',
        fc: '9:31',
        drop: '196.6 °C',
        weights: '375 g',
        loss: undefined,
        rating: undefined,
      },
    ],
  },
} satisfies Meta<typeof RoastTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** At the narrowest the bean page gets: a long profile name is cut short, the numbers never are. */
export const Narrow: Story = { args: { className: 'w-160' } };
