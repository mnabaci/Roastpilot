import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavList } from './NavList';

const ITEMS = [
  { id: 'controls', label: 'Controls' },
  { id: 'roast', label: 'Roast', detail: 'Cooling and charge' },
  { id: 'auto', label: 'Auto', badge: <span>NEW</span> },
];

describe('NavList', () => {
  it('names the list and marks the open item', () => {
    render(<NavList label="Sections" items={ITEMS} openId="roast" onOpen={vi.fn()} />);
    expect(screen.getByRole('list', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roast/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Controls' })).not.toHaveAttribute('aria-current');
  });

  it('shows the detail line and the badge', () => {
    render(<NavList label="Sections" items={ITEMS} openId={undefined} onOpen={vi.fn()} />);
    expect(screen.getByText('Cooling and charge')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('opens an item on click', async () => {
    const onOpen = vi.fn();
    render(<NavList label="Sections" items={ITEMS} openId="roast" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Controls' }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('controls');
  });

  it('moves focus with Up and Down', async () => {
    render(<NavList label="Sections" items={ITEMS} openId="roast" onOpen={vi.fn()} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /Roast/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: 'Controls' })).toHaveFocus();
  });

  describe('select mode', () => {
    const MINE = [
      { id: 'a', label: 'Light · Steps', detail: 'Built-in', locked: true },
      { id: 'b', label: 'Mine' },
      { id: 'c', label: 'Mine 2' },
    ];

    it('rows are checkboxes; a click ticks instead of opening, Shift asks for a range', async () => {
      const onOpen = vi.fn();
      const onCheck = vi.fn();
      const { rerender } = render(
        <NavList
          label="Profiles"
          items={MINE}
          openId="b"
          onOpen={onOpen}
          checked={new Set<string>()}
          onCheck={onCheck}
        />,
      );
      await userEvent.click(screen.getByRole('checkbox', { name: 'Mine' }));
      expect(onCheck).toHaveBeenLastCalledWith('b', false);
      const user = userEvent.setup();
      await user.keyboard('{Shift>}');
      await user.click(screen.getByRole('checkbox', { name: 'Mine 2' }));
      expect(onCheck).toHaveBeenLastCalledWith('c', true);
      expect(onOpen).not.toHaveBeenCalled();
      rerender(
        <NavList
          label="Profiles"
          items={MINE}
          openId="b"
          onOpen={onOpen}
          checked={new Set(['b'])}
          onCheck={onCheck}
        />,
      );
      expect(screen.getByRole('checkbox', { name: 'Mine' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Mine 2' })).not.toBeChecked();
    });

    it("a locked row can't be ticked and says why", async () => {
      const onCheck = vi.fn();
      render(
        <NavList
          label="Profiles"
          items={MINE}
          openId={undefined}
          onOpen={vi.fn()}
          checked={new Set<string>()}
          onCheck={onCheck}
        />,
      );
      const locked = screen.getByRole('checkbox', { name: /Light · Steps/ });
      expect(locked).toHaveAttribute('aria-disabled', 'true');
      expect(locked).toHaveTextContent('Built-in');
      await userEvent.click(locked);
      expect(onCheck).not.toHaveBeenCalled();
    });
  });
});
