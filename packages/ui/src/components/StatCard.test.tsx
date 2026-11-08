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
});
