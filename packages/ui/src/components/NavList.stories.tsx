import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Badge } from './Badge';
import { NavList } from './NavList';

const meta = {
  title: 'Navigation/NavList',
  component: NavList,
  args: {
    label: 'Roasters',
    items: [
      { id: 1, label: 'Skywalker', badge: <Badge tone="air">Active</Badge> },
      { id: 2, label: 'Simulator', detail: 'Practice without a roaster' },
      { id: 3, label: 'Skywalker at the cabin, with a name too long for the sidebar' },
    ],
    openId: 1,
    onOpen: () => undefined,
  },
  render: function Render(args) {
    const [openId, setOpenId] = useState(args.openId);
    return (
      <div className="w-sidebar">
        <NavList {...args} openId={openId} onOpen={setOpenId} />
      </div>
    );
  },
} satisfies Meta<typeof NavList<number>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Roasters: Story = {};
export const NothingOpen: Story = { args: { openId: undefined } };
export const SelectMode: Story = {
  args: {
    label: 'Profiles',
    items: [
      { id: 1, label: 'Light · Steps', detail: 'Built-in', locked: true },
      { id: 2, label: 'Guji light', detail: 'Auto uses this one', locked: true },
      { id: 3, label: 'Huila medium' },
      { id: 4, label: 'Milestones' },
    ],
    openId: undefined,
    checked: new Set([3]),
    onCheck: () => undefined,
  },
};
