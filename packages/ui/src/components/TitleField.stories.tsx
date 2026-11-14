import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TitleField } from './TitleField';

const meta = {
  title: 'Inputs/TitleField',
  component: TitleField,
  args: { value: 'Skywalker', onChange: () => undefined },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-[480px] px-2">
        <TitleField {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof TitleField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {};
export const NewRecord: Story = { args: { value: '', placeholder: 'Name this bean' } };
export const Invalid: Story = { args: { value: '', invalid: true } };
