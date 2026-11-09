import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CollapsibleCard } from './CollapsibleCard';
import { TextField } from './TextField';

const meta = {
  title: 'Layout/CollapsibleCard',
  component: CollapsibleCard,
  args: {
    title: 'Roast details',
    summary:
      'African Moon · 356 → 305 g · 14.3 % · ★★★★★ · Third auto roast curve, sweet and clean',
    spokenSummary: 'African Moon · 356 → 305 g · 14.3 % · rated 5 of 5 · Third auto roast curve',
    open: true,
    onOpenChange: () => undefined,
    children: null,
  },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    const [notes, setNotes] = useState('Third auto roast curve, sweet and clean');
    return (
      <CollapsibleCard {...args} open={open} onOpenChange={setOpen} className="max-w-2xl">
        <TextField label="Notes" value={notes} onChange={setNotes} />
      </CollapsibleCard>
    );
  },
} satisfies Meta<typeof CollapsibleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Folded: Story = { args: { open: false } };
/** Folded with nothing to sum up: the title alone. */
export const FoldedEmpty: Story = { args: { open: false, summary: undefined } };
