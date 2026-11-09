import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu';

const items = (onDuplicate = vi.fn(), onDelete = vi.fn()) => [
  { label: 'Duplicate', onSelect: onDuplicate },
  { label: 'Copy to Skywalker', onSelect: vi.fn(), disabled: true },
  { label: 'Delete', onSelect: onDelete, destructive: true },
];

describe('Menu', () => {
  it('is a named button that opens a menu of its items', async () => {
    render(<Menu label="More for Light · Steps" items={items()} />);
    const button = screen.getByRole('button', { name: 'More for Light · Steps' });
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Duplicate',
      'Copy to Skywalker',
      'Delete',
    ]);
  });

  it('runs the picked item and closes', async () => {
    const onDuplicate = vi.fn();
    render(<Menu label="More" items={items(onDuplicate)} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('works from the keyboard and Escape closes it', async () => {
    const onDelete = vi.fn();
    render(<Menu label="More" items={items(vi.fn(), onDelete)} />);
    screen.getByRole('button', { name: 'More' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  });

  it('a disabled item does nothing', async () => {
    render(<Menu label="More" items={items()} />);
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: 'Copy to Skywalker' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it("says why a disabled item can't be picked now in a tooltip, not a line under it", async () => {
    render(
      <Menu
        label="More"
        items={[
          {
            label: 'Use this roaster',
            onSelect: vi.fn(),
            disabled: true,
            hint: 'Disconnect first',
          },
          { label: 'Export this roaster', onSelect: vi.fn() },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    const item = screen.getByRole('menuitem', { name: 'Use this roaster' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('Disconnect first');
    expect(screen.getByRole('menuitem', { name: 'Export this roaster' })).not.toHaveAttribute(
      'aria-describedby',
    );
    // Only in the tooltip, which opens after a short rest on the item.
    expect(screen.queryByRole('tooltip')).toBeNull();
    await userEvent.hover(item);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Disconnect first');
  });

  it('can be a worded button with a chevron', async () => {
    const onDuplicate = vi.fn();
    render(<Menu label="Make profile" text="Make profile" items={items(onDuplicate)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Make profile' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onDuplicate).toHaveBeenCalledOnce();
  });
});
