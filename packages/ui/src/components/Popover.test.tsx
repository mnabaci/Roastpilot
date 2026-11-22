import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Popover, PopoverClose } from './Popover';

describe('Popover', () => {
  it('opens on click with focus on the panel, closes with Escape back to its button', async () => {
    render(
      <Popover label="Falcon" trigger={<button type="button">Falcon</button>}>
        <p>sales@falcon.coffee</p>
        <button type="button">Edit supplier</button>
      </Popover>,
    );
    expect(screen.queryByText('sales@falcon.coffee')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Falcon' }));
    const panel = await screen.findByRole('dialog', { name: 'Falcon' });
    expect(panel).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Falcon' })).toHaveFocus();
  });

  it('closes when its action is taken', async () => {
    const onEdit = vi.fn();
    render(
      <Popover label="Falcon" trigger={<button type="button">Falcon</button>}>
        <PopoverClose asChild>
          <button type="button" onClick={onEdit}>
            Edit supplier
          </button>
        </PopoverClose>
      </Popover>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Falcon' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit supplier' }));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
