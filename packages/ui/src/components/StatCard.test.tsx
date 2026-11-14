import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('shows the value, unit and context', () => {
    render(<StatCard label="Temperature" value={198} unit="°C" context="Target 196 °C" />);
    const card = screen.getByRole('region', { name: 'Temperature' });
    expect(card).toHaveTextContent('198');
    expect(card).toHaveTextContent('°C');
    expect(card).toHaveTextContent('Target 196 °C');
  });

  it('shows an em dash and no unit when there is no value', () => {
    render(<StatCard label="Rate of rise" value={null} unit="°C/min" />);
    const card = screen.getByRole('region', { name: 'Rate of rise' });
    expect(card).toHaveTextContent('—');
    expect(card).not.toHaveTextContent('°C/min');
  });

  it('shows an em dash, never NaN, for a reading that is not a number', () => {
    render(<StatCard label="Rate of rise" value={Number.NaN} unit="°C/min" />);
    const card = screen.getByRole('region', { name: 'Rate of rise' });
    expect(card).toHaveTextContent('—');
    expect(card).not.toHaveTextContent('NaN');
    expect(card).not.toHaveTextContent('°C/min');
  });

  it('writes a negative value with a real minus sign', () => {
    render(<StatCard label="Rate of rise" value="-7.7" unit="°C/min" />);
    expect(screen.getByRole('region', { name: 'Rate of rise' })).toHaveTextContent('\u22127.7');
  });

  it('shows a second reading beside the label, with its own name and unit', () => {
    render(
      <StatCard
        label="Temperature"
        value={198}
        unit="°C"
        secondary={{ label: 'ET', value: '212.4', unit: '°C', tone: 'env' }}
      />,
    );
    const card = screen.getByRole('region', { name: 'Temperature' });
    expect(card).toHaveTextContent('ET212.4°C');
  });

  it('shows a dash and no unit for a second reading not known yet', () => {
    render(
      <StatCard
        label="Temperature"
        value={198}
        unit="°C"
        secondary={{ label: 'ET', value: undefined, unit: '°F' }}
      />,
    );
    const card = screen.getByRole('region', { name: 'Temperature' });
    expect(card).toHaveTextContent('ET—');
    expect(card).not.toHaveTextContent('°F');
  });

  it('shows a compact tile with the same value, unit and context', () => {
    render(<StatCard label="TC1" value="24.6" unit="°C" context="BT" tone="heat" size="compact" />);
    const tile = screen.getByRole('region', { name: 'TC1' });
    expect(tile).toHaveTextContent('24.6');
    expect(tile).toHaveTextContent('°C');
    expect(tile).toHaveTextContent('BT');
    expect(tile.className).toContain('bg-surface-raised');
  });
});
