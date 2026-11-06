import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const renderDialog = (onConfirm = vi.fn(), onOpenChange = vi.fn()) =>
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      question="Delete this roast?"
      detail="can't be undone"
      confirmLabel="Delete"
      destructive
      onConfirm={onConfirm}
    />,
  );

describe('ConfirmDialog', () => {
  it('asks the question with what happens, as an alert dialog', () => {
    renderDialog();
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this roast?' });
    expect(dialog).toHaveAccessibleDescription("can't be undone");
  });

  it('starts on Cancel, so Enter never confirms by accident', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms and closes', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog(onConfirm, onOpenChange);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Escape and Cancel close without confirming', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog(onConfirm, onOpenChange);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
