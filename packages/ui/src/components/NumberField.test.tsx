import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('is a labelled text input showing the value and unit', () => {
    render(<NumberField label="Charge temp" value="180" unit="°C" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Charge temp' })).toHaveValue('180');
    expect(screen.getByText('°C')).toBeInTheDocument();
  });

  it('reports what you type, half-typed values too', async () => {
    const onChange = vi.fn();
    render(<NumberField label="Time" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '1');
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('keeps the label for screen readers when hidden', () => {
    render(<NumberField label="Fan" hideLabel value="30" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Fan' })).toBeInTheDocument();
  });

  it('marks an invalid value and ties its message to the field', () => {
    render(
      <NumberField label="BT cap" value="300" invalid hint="At most 235 °C" onChange={vi.fn()} />,
    );
    const field = screen.getByRole('textbox', { name: 'BT cap' });
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription('At most 235 °C');
  });

  it('can be disabled', () => {
    render(<NumberField label="Fan" value="30" disabled onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
