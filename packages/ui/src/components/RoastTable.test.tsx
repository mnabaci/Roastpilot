import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoastTable } from './RoastTable';

const ROW = {
  id: 17,
  title: 'Sun 8 Nov · 16:45',
  ran: 'Auto · Light · Curve',
  time: '10:20',
  fc: '8:34',
  drop: '197.0 °C',
  weights: '356 → 305 g',
  loss: '14.3 %',
  rating: '5/5',
};

describe('RoastTable', () => {
  it('one row per roast, its numbers under their headings; a missing value is a dash', () => {
    render(
      <RoastTable
        label="Roasts of African Moon"
        rows={[ROW, { ...ROW, id: 6, ran: 'Manual', fc: undefined, weights: undefined }]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Roasts of African Moon' });
    const headings = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headings).toEqual([
      'Roast',
      'Ran as',
      'Time',
      'FC',
      'Drop',
      'Green → roasted',
      'Loss',
      'Rating',
    ]);
    const [first, second] = within(table).getAllByRole('row').slice(1);
    expect(first?.textContent).toBe(
      'Sun 8 Nov · 16:45Auto · Light · Curve10:208:34197.0 °C356 → 305 g14.3 %5/5',
    );
    expect(second?.textContent).toContain('Manual10:20–197.0 °C–14.3 %');
  });

  it('stars a favourite after its date', () => {
    render(<RoastTable label="Roasts" rows={[{ ...ROW, favourite: true }]} />);
    const roast = screen.getByRole('rowheader');
    expect(within(roast).getByRole('img', { name: 'Favourite' })).toBeInTheDocument();
  });
});

describe('RoastTable with onOpen', () => {
  it("opens a roast from its date's button, or from anywhere on its row, once", async () => {
    const onOpen = vi.fn();
    render(<RoastTable label="Roasts" rows={[ROW, { ...ROW, id: 16 }]} onOpen={onOpen} />);
    const [first, second] = screen.getAllByRole('button', { name: 'Sun 8 Nov · 16:45' });
    await userEvent.click(first!);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(17);
    await userEvent.click(within(screen.getAllByRole('row')[2]!).getByText('356 → 305 g'));
    expect(onOpen).toHaveBeenLastCalledWith(16);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(second).toBeDefined();
  });

  it('has no buttons without onOpen', () => {
    render(<RoastTable label="Roasts" rows={[ROW]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
