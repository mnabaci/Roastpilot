import type { Meta, StoryObj } from '@storybook/react-vite';
import { Globe, Mail, Pencil } from 'lucide-react';
import { Button } from './Button';
import { Popover, PopoverClose } from './Popover';

const meta = {
  title: 'Feedback/Popover',
  component: Popover,
  args: {
    label: 'Green Coffee Collective',
    className: 'w-96',
    trigger: (
      <button type="button" className="text-body underline underline-offset-4">
        Green Coffee Collective
      </button>
    ),
    children: (
      <>
        <div className="flex flex-col gap-0.5">
          <p className="text-body font-semibold text-ink">Green Coffee Collective</p>
          <p className="text-label text-ink-muted">Supplies African Moon and Washed Eratoi</p>
        </div>
        <ul className="flex flex-col gap-2 border-t border-border pt-3 text-body">
          <li className="flex items-center gap-2.5">
            <Globe aria-hidden="true" className="size-4 text-ink-muted" />
            greencoffeecollective.com
          </li>
          <li className="flex items-center gap-2.5">
            <Mail aria-hidden="true" className="size-4 text-ink-muted" />
            hello@greencoffeecollective.com
          </li>
        </ul>
        <PopoverClose asChild>
          <Button
            size="sm"
            variant="ghost"
            className="-ml-2 self-start px-2"
            icon={<Pencil aria-hidden="true" />}
          >
            Edit supplier
          </Button>
        </PopoverClose>
      </>
    ),
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SupplierCard: Story = {};
export const SupplierCardLight: Story = { globals: { theme: 'Light' } };
