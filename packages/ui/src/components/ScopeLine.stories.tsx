import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ScopeLine } from './ScopeLine';

const meta = {
  title: 'Navigation/ScopeLine',
  component: ScopeLine,
} satisfies Meta<typeof ScopeLine>;

export default meta;
type Story = StoryObj<typeof meta>;

function Picker() {
  const [value, setValue] = useState('active');
  return (
    <div className="w-60">
      <h1 className="text-title">History</h1>
      <ScopeLine
        label="Roaster"
        value={value}
        onChange={setValue}
        options={[
          { value: 'active', label: 'Skywalker', detail: '12 roasts' },
          { value: '2', label: 'Simulator', detail: '2 roasts' },
          { value: 'all', label: 'All roasters', detail: '14 roasts' },
        ]}
      />
    </div>
  );
}

export const HistoryPicker: Story = {
  args: { label: 'Roaster', text: '' },
  render: () => <Picker />,
};
export const ProfilesText: Story = {
  args: {
    label: 'Roaster',
    text: 'Skywalker',
    tooltip: 'Profiles follow the active roaster · change it in Roasters',
  },
  render: (args) => (
    <div className="w-60">
      <h1 className="text-title">Profiles</h1>
      <ScopeLine {...args} />
    </div>
  ),
};
