import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Mark } from './Mark';

describe('Mark', () => {
  it('is decoration, with the name as text when asked', () => {
    const { container, rerender } = render(<Mark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText('Roastpilot')).not.toBeInTheDocument();
    rerender(<Mark withName />);
    expect(screen.getByText('Roastpilot')).toBeInTheDocument();
  });

  it('gives each mark its own clip path, so two on a page never share one', () => {
    const { container } = render(
      <>
        <Mark />
        <Mark />
      </>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });
});
