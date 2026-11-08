import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SelectField } from './SelectField';
import type { SelectOption } from './Select';

const BEANS: SelectOption<string>[] = [
  { value: 'none', label: 'No bean' },
  { value: '1', label: 'Ethiopia Guji', detail: '300 g · Ethiopia · washed' },
  { value: '2', label: 'Colombia Huila', detail: '1.2 kg · Colombia · natural' },
  { value: '3', label: 'Kenya AA', detail: 'Out of stock', disabled: true },
];

const GHOSTS: SelectOption<string>[] = [
  { value: 'none', label: 'None' },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i + 1),
    label: `${String(i + 1)} Nov · 10:00`,
    detail: `${i % 2 ? 'Colombia Huila' : 'Ethiopia Guji'} · ${'★'.repeat((i % 5) + 1)} · FC 9:${String(10 + i)}`,
  })),
];

/** The panel every dropdown opens, shown through a SelectField (design system: Select). */
const meta = {
  title: 'Inputs/Select',
  component: SelectField<string>,
  args: { label: 'Bean', value: '1', options: BEANS, onChange: () => undefined },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SelectField {...args} value={value} onChange={setValue} className="w-72" />;
  },
} satisfies Meta<typeof SelectField<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDetails: Story = {};
export const LongListWithSearch: Story = {
  args: { label: 'Ghost', value: 'none', options: GHOSTS },
};
/** A state at the row's end, as the Profile picker's Needs calibration: the name truncates first. */
export const WithBadges: Story = {
  args: {
    label: 'Profile',
    value: 'mine',
    options: [
      { value: 'light', label: 'Light · Steps', detail: 'Built-in' },
      { value: 'medium', label: 'Medium · Curve', detail: 'Built-in' },
      { value: 'mine', label: 'Ethiopia Guji · light steps', badge: 'Needs calibration' },
    ],
  },
};
export const WithBadgesLight: Story = { ...WithBadges, globals: { theme: 'Light' } };
export const Short: Story = {
  args: {
    label: 'Process',
    value: 'washed',
    options: [
      { value: 'washed', label: 'Washed' },
      { value: 'natural', label: 'Natural' },
      { value: 'honey', label: 'Honey' },
      { value: 'other', label: 'Other' },
    ],
  },
};
