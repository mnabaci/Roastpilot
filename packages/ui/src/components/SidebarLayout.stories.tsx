import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavList } from './NavList';
import { SidebarLayout } from './SidebarLayout';

const SECTIONS = ['Controls', 'Roast', 'Auto', 'Chart'].map((label) => ({ id: label, label }));

const meta = {
  title: 'Navigation/SidebarLayout',
  component: SidebarLayout,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Settings',
    contentLabel: 'Roast',
    sidebar: <NavList label="Sections" items={SECTIONS} openId="Roast" onOpen={() => undefined} />,
    children: <p className="text-body text-ink-muted">The open section goes here.</p>,
  },
  render: (args) => (
    <div className="flex h-screen flex-col">
      <SidebarLayout {...args} />
    </div>
  ),
} satisfies Meta<typeof SidebarLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = {};
export const LongList: Story = {
  args: {
    title: 'Profiles',
    contentLabel: 'Profile',
    sidebar: (
      <NavList
        label="Profiles"
        items={Array.from({ length: 30 }, (_, i) => ({ id: i, label: `Profile ${String(i + 1)}` }))}
        openId={3}
        onOpen={() => undefined}
      />
    ),
  },
};
