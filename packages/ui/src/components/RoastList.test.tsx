import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoastList } from './RoastList';

const ITEMS = [
  { id: 3, title: 'Wed 4 Nov · 14:32', numbers: '9:40 · FC 8:00 · 205.5 °C' },
  { id: 2, title: 'Wed 4 Nov · 11:05', numbers: '4:12', badge: 'Unfinished' },
  { id: 1, title: 'Mon 2 Nov · 18:20', numbers: '' },
];

describe('RoastList', () => {
  it('shows each roast with its numbers and badge, and marks the selected one', () => {
    render(<RoastList label="Saved roasts" items={ITEMS} selectedId={3} onSelect={vi.fn()} />);
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[0]).toHaveTextContent('9:40 · FC 8:00 · 205.5 °C');
    expect(rows[1]).toHaveTextContent('Unfinished');
    expect(rows[2]).not.toHaveAttribute('aria-current');
  });

  it('a click selects', async () => {
    const onSelect = vi.fn();
    render(<RoastList label="Saved roasts" items={ITEMS} selectedId={3} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /11:05/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('Up and Down move between rows, stopping at the ends', async () => {
    render(<RoastList label="Saved roasts" items={ITEMS} selectedId={3} onSelect={vi.fn()} />);
    const rows = screen.getAllByRole('button');
    rows[0]?.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(rows[0]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(rows[2]).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(rows[1]).toHaveFocus();
  });
});
