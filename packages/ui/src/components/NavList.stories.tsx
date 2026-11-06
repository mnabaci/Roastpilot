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
