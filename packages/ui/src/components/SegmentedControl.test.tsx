import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const TIMES = [
  { value: 2, label: '2 min' },
  { value: 4, label: '4 min' },
  { value: 6, label: '6 min' },
] as const;

describe('SegmentedControl', () => {
  it('is a radio group with the chosen option checked', () => {
    render(<SegmentedControl label="Cooling time" options={TIMES} value={4} onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Cooling time' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4 min' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '2 min' })).not.toBeChecked();
  });

  it('chooses an option on click', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Cooling time" options={TIMES} value={4} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '6 min' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
  });

  it('is one Tab stop, on the chosen option', async () => {
    render(<SegmentedControl label="Cooling time" options={TIMES} value={4} onChange={vi.fn()} />);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: '4 min' })).toHaveFocus();
  });

  it('moves the choice with the arrow keys, wrapping at the ends', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Cooling time" options={TIMES} value={6} onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(2);
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('ignores clicks and keys when disabled', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl label="Soak" options={TIMES} value={4} onChange={onChange} disabled />,
    );
    await userEvent.click(screen.getByRole('radio', { name: '2 min' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
