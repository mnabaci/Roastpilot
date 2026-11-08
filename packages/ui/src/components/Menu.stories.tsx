import type { Meta, StoryObj } from '@storybook/react-vite';
import { Menu } from './Menu';

const meta = {
  title: 'Actions/Menu',
  component: Menu,
  args: {
    label: 'More for Light · Steps',
    items: [
      { label: 'Duplicate', onSelect: () => undefined },
      { label: 'Copy to Skywalker', onSelect: () => undefined },
      { label: 'Delete', onSelect: () => undefined, destructive: true },
    ],
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileActions: Story = {};
export const WithDisabled: Story = {
  args: {
    items: [
      { label: 'Duplicate', onSelect: () => undefined },
      { label: 'Delete', onSelect: () => undefined, destructive: true, disabled: true },
    ],
  },
};
export const DisabledWithReason: Story = {
  args: {
    label: 'More for Skywalker',
    items: [
      {
        label: 'Use this roaster',
        onSelect: () => undefined,
        disabled: true,
        hint: 'Already the active one',
      },
      { label: 'Export this roaster', onSelect: () => undefined },
      {
        label: 'Delete',
        onSelect: () => undefined,
        destructive: true,
        disabled: true,
        hint: 'Use another roaster first',
      },
    ],
  },
};
