import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TextAreaField } from './TextAreaField';

const meta = {
  title: 'Inputs/TextAreaField',
  component: TextAreaField,
  args: { label: 'Notes', value: '', onChange: () => undefined },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <TextAreaField {...args} value={value} onChange={setValue} className="max-w-md" />;
  },
} satisfies Meta<typeof TextAreaField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const OneLine: Story = { args: { value: 'Third auto roast curve, sweet and clean' } };
/** Grows a line at a time, then scrolls inside past 192px. */
export const Long: Story = {
  args: {
    value:
      'Third auto roast curve.\nSweet and clean, a little bright.\nNext time: 10 s more development.\nDrop 2 °C earlier.\nRested 3 days.\nCupped with Anna.\nTry 5 g less.',
  },
};
export const Disabled: Story = { args: { value: 'Saving as it roasts', disabled: true } };
