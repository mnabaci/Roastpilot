import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventTable } from './EventTable';

describe('EventTable', () => {
  it('one row per event with its values; a missing value is a dash', () => {
    render(
      <EventTable
        rows={[
          {
            event: 'Charge',
            time: '0:00',
            bt: '181.0 °C',
            ror: undefined,
            heater: '0 %',
            fan: '30 %',
          },
          {
            event: 'First crack',
            time: '9:31',
            bt: '191.3 °C',
            ror: '7.6',
            heater: '30 %',
            fan: '100 %',
          },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Events' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Event', 'Time', 'Temp', 'RoR', 'Heater', 'Fan']);
    const charge = within(table).getByRole('row', { name: /Charge/ });
    expect(
      within(charge)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['0:00', '181.0 °C', '–', '0 %', '30 %']);
  });

  it("heads the temperature column with the roaster's short name", () => {
    render(<EventTable rows={[]} tempLabel="BT" />);
    expect(screen.getByRole('columnheader', { name: 'BT' })).toBeInTheDocument();
  });

  it('keeps two events with the same name and no time apart', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const row = {
      event: 'Note',
      time: undefined,
      bt: undefined,
      ror: undefined,
      heater: undefined,
      fan: undefined,
    };
    render(<EventTable rows={[row, { ...row, bt: '150.0 °C' }]} />);
    expect(screen.getAllByRole('row', { name: /Note/ })).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
