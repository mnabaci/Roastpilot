import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

const renderDialog = (onOpenChange = vi.fn()) =>
  render(
    <Dialog
      open
      onOpenChange={onOpenChange}
      title="Batch calculator"
      description="How an order splits into batches"
    >
      <button type="button">Inside</button>
    </Dialog>,
  );

describe('Dialog', () => {
  it('is a dialog named by its title and described by its line', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Batch calculator' });
    expect(dialog).toHaveAccessibleDescription('How an order splits into batches');
    expect(screen.getByRole('button', { name: 'Inside' })).toBeInTheDocument();
  });

  it('closes on Close and on Escape', async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
