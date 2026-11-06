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
});
