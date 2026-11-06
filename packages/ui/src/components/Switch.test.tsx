import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('is a switch named by its setting, showing its state', () => {
    render(<Switch aria-label="Find the charge point" checked onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: 'Find the charge point' })).toBeChecked();
  });

  it('asks for the other state when clicked', async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Cool the roaster" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('toggles with Space from the keyboard', async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Cool the roaster" checked onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('does nothing when disabled', async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Cool the roaster" checked onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
