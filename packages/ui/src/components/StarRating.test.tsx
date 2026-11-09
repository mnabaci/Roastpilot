import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { spokenRating, StarRating } from './StarRating';

describe('StarRating', () => {
  it('shows a rating as stars, said in words', () => {
    render(<StarRating value={4} />);
    expect(screen.getByRole('img', { name: 'Rated 4 of 5' })).toBeInTheDocument();
  });

  it('shows a dash for no rating', () => {
    render(<StarRating value={null} />);
    expect(screen.getByLabelText('Not rated')).toHaveTextContent('–');
  });

  it('as a picker, sets the stars pressed, and the same star again clears it', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<StarRating value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    rerender(<StarRating value={4} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Rating' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('says ratings in words', () => {
    expect(spokenRating(5)).toBe('Rated 5 of 5');
    expect(spokenRating(null)).toBe('Not rated');
  });
});
