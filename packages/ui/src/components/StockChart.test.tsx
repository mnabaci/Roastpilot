import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StockChart, type StockPoint } from './StockChart';

const DAY_MS = 24 * 60 * 60 * 1000;
const grams = (g: number) => `${String(Math.round(g))} g`;
const POINTS: StockPoint[] = [
  { atMs: 0, valueG: 2000, date: '1 Oct', what: 'Bought · +2000 g' },
  { atMs: 10 * DAY_MS, valueG: 1600, date: '11 Oct', what: 'Roasted · −400 g' },
];

describe('StockChart', () => {
  it('is a picture named by its summary, with its scale and ends', () => {
    render(
      <StockChart
        label="Green stock"
        points={POINTS}
        lowG={500}
        nowMs={20 * DAY_MS}
        formatGrams={grams}
      />,
    );
    expect(screen.getByRole('img', { name: 'Green stock' })).toBeInTheDocument();
    expect(screen.getByText('2000 g')).toBeInTheDocument();
    expect(screen.getByText('Low 500 g')).toBeInTheDocument();
    expect(screen.getByText('1 Oct')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('leaves the low-stock line out at 0', () => {
    render(
      <StockChart
        label="Green stock"
        points={POINTS}
        lowG={0}
        nowMs={20 * DAY_MS}
        formatGrams={grams}
      />,
    );
    expect(screen.queryByText(/^Low/)).not.toBeInTheDocument();
  });

  it('shows the step under the pointer, and hides it on leave', () => {
    render(
      <StockChart label="Green stock" points={POINTS} nowMs={20 * DAY_MS} formatGrams={grams} />,
    );
    const plot = screen.getByRole('img', { name: 'Green stock' });
    plot.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    // Three quarters along: after the roast on day 10.
    fireEvent.pointerMove(plot, { clientX: 150 });
    expect(screen.getByText('Roasted · −400 g')).toBeInTheDocument();
    expect(screen.getByText('1600 g green')).toBeInTheDocument();
    fireEvent.pointerLeave(plot);
    expect(screen.queryByText('Roasted · −400 g')).not.toBeInTheDocument();
  });

  it('draws nothing with no points', () => {
    const { container } = render(
      <StockChart label="Green stock" points={[]} nowMs={0} formatGrams={grams} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
