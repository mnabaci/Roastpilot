import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReadValue } from './ReadValue';

const meta = {
  title: 'Inputs/ReadValue',
  component: ReadValue,
  args: { label: 'Origin', value: 'Uganda' },
  render: (args) => (
    <div className="w-60">
      <ReadValue {...args} />
    </div>
  ),
} satisfies Meta<typeof ReadValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {};
export const Numeric: Story = { args: { label: 'Max temp', value: '240 °C', numeric: true } };
export const Empty: Story = { args: { label: 'Moisture', value: '' } };
