import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompareTable } from './CompareTable';

describe('CompareTable', () => {
  it('shows this roast, the compared one and the difference, a dash or a blank where missing', () => {
    render(
      <CompareTable
        otherTitle="Mon 2 Nov · 18:20"
        rows={[
          { label: 'Total', own: '9:54', other: '9:00', diff: '+0:54' },
          { label: 'Dry end', own: '4:30 · 150.0 °C', other: undefined, diff: undefined },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Comparison' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Measure', 'This roast', 'Mon 2 Nov · 18:20', 'Difference']);
    const cells = (name: RegExp) =>
      within(within(table).getByRole('row', { name }))
        .getAllByRole('cell')
        .map((c) => c.textContent);
    expect(within(table).getByRole('rowheader', { name: 'Total' })).toBeInTheDocument();
    expect(cells(/^Total/)).toEqual(['9:54', '9:00', '+0:54']);
    expect(cells(/^Dry end/)).toEqual(['4:30 · 150.0 °C', '–', '']);
  });
});
