import type { Meta, StoryObj } from '@storybook/react-vite';
import { EventTable } from './EventTable';

const meta = {
  title: 'Data/EventTable',
  component: EventTable,
  args: {
    className: 'w-md',
    rows: [
      { event: 'Charge', time: '0:00', bt: '181.0 °C', ror: undefined, heater: '0 %', fan: '30 %' },
      {
        event: 'Turning point',
        time: '1:04',
        bt: '92.2 °C',
        ror: undefined,
        heater: '85 %',
        fan: '30 %',
      },
      {
        event: 'First crack',
        time: '9:31',
        bt: '191.3 °C',
        ror: '7.6',
        heater: '30 %',
        fan: '100 %',
      },
      { event: 'Drop', time: '11:03', bt: '196.6 °C', ror: '3.4', heater: '30 %', fan: '100 %' },
      {
        event: 'Cool end',
        time: '15:03',
        bt: '110.5 °C',
        ror: undefined,
        heater: '0 %',
        fan: '100 %',
      },
    ],
  },
} satisfies Meta<typeof EventTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};
export const Unfinished: Story = {
  args: {
    rows: [
      { event: 'Charge', time: '0:00', bt: '181.0 °C', ror: undefined, heater: '0 %', fan: '30 %' },
    ],
  },
};
