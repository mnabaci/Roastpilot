import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoastList } from './RoastList';
import { TOOLTIP_DELAY_MS } from './Tooltip';

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

  it('shows the second line and marks a favourite', () => {
    render(
      <RoastList
        label="Saved roasts"
        items={[
          {
            id: 1,
            title: 'Wed',
            numbers: '9:40',
            detail: ['Yirgacheffe', 'Auto · Light · Steps', '4/5'],
            favourite: true,
          },
        ]}
        selectedId={undefined}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(
      'Yirgacheffe · Auto · Light · Steps · 4/5',
    );
    expect(screen.getByRole('img', { name: 'Favourite' })).toBeTruthy();
  });

  it('in select mode the rows are checkboxes, and Shift asks for a range', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onCheck = vi.fn();
    render(
      <RoastList
        label="Saved roasts"
        items={ITEMS}
        selectedId={undefined}
        onSelect={onSelect}
        checked={new Set([ITEMS[0]?.id ?? 0])}
        onCheck={onCheck}
      />,
    );
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    await user.click(boxes[1]!);
    expect(onCheck).toHaveBeenLastCalledWith(ITEMS[1]?.id, false);
    await user.keyboard('{Shift>}');
    await user.click(boxes[1]!);
    await user.keyboard('{/Shift}');
    expect(onCheck).toHaveBeenLastCalledWith(ITEMS[1]?.id, true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows the whole second line in a tooltip when you rest on a row', () => {
    vi.useFakeTimers();
    try {
      render(
        <RoastList
          label="Saved roasts"
          items={[{ id: 1, title: 'Wed', numbers: '9:40', detail: ['African Moon', 'Manual'] }]}
          selectedId={undefined}
          onSelect={() => undefined}
        />,
      );
      fireEvent.pointerOver(screen.getByRole('button'));
      act(() => {
        vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
      });
      expect(screen.getByRole('tooltip')).toHaveTextContent('African Moon · Manual');
    } finally {
      vi.useRealTimers();
    }
  });
});
