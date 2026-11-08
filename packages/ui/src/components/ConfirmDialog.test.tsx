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

  it('lists what happens, and starts on the keep-going answer', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        question="Stop the roast?"
        consequences={['Heater, fan, drum and filter off now', 'The roast is saved as stopped']}
        cancelLabel="Keep roasting"
        confirmLabel="Stop roast"
        caution
        icon={<svg />}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Stop the roast?' });
    expect(dialog).toHaveAccessibleDescription(
      'Heater, fan, drum and filter off now The roast is saved as stopped',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Keep roasting' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Stop roast' }));
    expect(onConfirm).toHaveBeenCalledOnce();
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

  it('offers a second answer when given one', async () => {
    const onConfirm = vi.fn();
    const keep = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        question="Clear this roast?"
        detail="Return 375 g of Ethiopia Guji to stock?"
        confirmLabel="Return to stock"
        onConfirm={onConfirm}
        alternative={{ label: 'Keep deducted', onSelect: keep }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep deducted' }));
    expect(keep).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
