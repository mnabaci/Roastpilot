import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { OutputControl, type OutputControlProps } from './OutputControl';

/** Keeps the slider interactive in Storybook. */
function Stateful(props: OutputControlProps) {
  const [value, setValue] = useState(props.value);
  const [mode, setMode] = useState(props.mode);
  return (
    <OutputControl
      {...props}
      value={value}
      mode={mode}
      onChange={(next) => {
        setValue(next);
        setMode('manual');
        props.onChange(next);
      }}
      onResumeAuto={() => {
        setMode('auto');
        props.onResumeAuto?.();
      }}
    />
  );
}

const meta = {
  title: 'Controls/OutputControl',
  component: OutputControl,
  render: (args) => <Stateful {...args} />,
  args: {
    label: 'Heater',
    value: 65,
    mode: 'auto',
    tone: 'heat',
    onChange: fn(),
    onResumeAuto: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-xl bg-surface p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutputControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HeaterAuto: Story = {};
export const HeaterManual: Story = { args: { mode: 'manual', value: 75 } };
export const Fan: Story = { args: { label: 'Fan', tone: 'air', value: 30 } };
export const Locked: Story = { args: { disabled: true, value: 0 } };
