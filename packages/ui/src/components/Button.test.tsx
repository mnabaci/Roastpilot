import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('is a real button that defaults to type="button"', () => {
    render(<Button>Drop now</Button>);
    expect(screen.getByRole('button', { name: 'Drop now' })).toHaveAttribute('type', 'button');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Preheat</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Preheat' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Heating…
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Heating…' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
