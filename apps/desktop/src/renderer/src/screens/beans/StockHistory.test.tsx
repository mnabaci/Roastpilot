import { ok, type StockMovement } from '@roastpilot/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BEAN } from '../../test/beans';
import { fakeApi, renderApp } from '../../test/render-app';
import { StockHistory } from './StockHistory';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY_MS).toISOString();
const MOVEMENTS: StockMovement[] = [
  { at: '2026-09-01', kind: 'bought', greenG: 2000, roastedG: 0, roastId: null, note: null },
  { at: ago(28), kind: 'roasted', greenG: -400, roastedG: 340, roastId: 1, note: null },
  { at: ago(14), kind: 'roasted', greenG: -400, roastedG: 340, roastId: 2, note: null },
  { at: ago(7), kind: 'counted', greenG: -50, roastedG: 0, roastId: null, note: null },
];

function show(movements: StockMovement[], greenG = 1150) {
  const api = fakeApi({ stockHistory: vi.fn(() => Promise.resolve(ok(movements))) });
  renderApp(<StockHistory bean={{ ...BEAN, greenG }} nowMs={NOW} />, {}, api);
  return api;
}

describe('StockHistory', () => {
  it('sums it up while folded', async () => {
    show(MOVEMENTS);
    const header = await screen.findByRole('button', { name: 'Stock history' });
    expect(header).toHaveAccessibleDescription('Bought once · 200 g a week');
  });

  it('opens on what it adds up to, the chart and the movements, newest first', async () => {
    show(MOVEMENTS);
    await userEvent.click(await screen.findByRole('button', { name: 'Stock history' }));
    expect(screen.getByText('once · 2,000 g')).toBeInTheDocument();
    expect(screen.getByText('2 roasts · 800 g')).toBeInTheDocument();
    expect(screen.getByText('About 6 weeks')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Green stock from 2,000 g on 1 Sept to 1,150 g today' }),
    ).toBeInTheDocument();
    const rows = within(screen.getByRole('table', { name: 'Stock movements' })).getAllByRole('row');
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      '2 NovCounted−50 g1,150 g',
      '26 OctRoasted−400 g1,200 g',
      '12 OctRoasted−400 g1,600 g',
      '1 SeptBought+2,000 g2,000 g',
    ]);
  });

  it('keeps a deleted roast as "Roasted · roast deleted", so the stock adds up', async () => {
    show([...MOVEMENTS.slice(0, 1), { ...MOVEMENTS[1], roastId: null } as StockMovement], 1600);
    await userEvent.click(await screen.findByRole('button', { name: 'Stock history' }));
    const rows = within(screen.getByRole('table', { name: 'Stock movements' })).getAllByRole('row');
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      '12 OctRoasted · roast deleted−400 g1,600 g',
      '1 SeptBought+2,000 g2,000 g',
    ]);
  });

  it('says how it starts with no history', async () => {
    show([], 0);
    expect(
      await screen.findByRole('button', { name: 'Stock history' }),
    ).toHaveAccessibleDescription('Nothing yet');
    await userEvent.click(screen.getByRole('button', { name: 'Stock history' }));
    expect(
      screen.getByText('Adjust stock or roast this bean, and its history starts here'),
    ).toBeInTheDocument();
  });

  it('shows six movements, then all of them on Show all', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      at: ago(40 - i),
      kind: 'roasted' as const,
      greenG: -100,
      roastedG: 85,
      roastId: i + 1,
      note: null,
    }));
    show(many, 1000);
    await userEvent.click(await screen.findByRole('button', { name: 'Stock history' }));
    const table = () => screen.getByRole('table', { name: 'Stock movements' });
    expect(within(table()).getAllByRole('row')).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(within(table()).getAllByRole('row')).toHaveLength(9);
  });
});
