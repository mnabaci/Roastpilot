import type { Meta, StoryObj } from '@storybook/react-vite';
import { Dialog } from './Dialog';
import { NumberField } from './NumberField';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  args: {
    open: true,
    onOpenChange: () => undefined,
    title: 'Batch calculator',
    description: 'How an order splits into batches on the active roaster',
    children: <NumberField label="Order weight" unit="g" value="1000" onChange={() => undefined} />,
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDescription: Story = {};
export const TitleOnly: Story = { args: { description: undefined } };
