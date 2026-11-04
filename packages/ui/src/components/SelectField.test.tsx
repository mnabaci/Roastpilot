import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

const OPTIONS = [
  { value: 'none', label: 'None' },
  { value: '2', label: 'Mon 2 Nov · 18:20' },
] as const;

describe('SelectField', () => {
  it('is a labelled select showing the value', () => {
    render(<SelectField label="Compare with" value="2" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Compare with' })).toHaveValue('2');
  });

  it('reports the picked value', async () => {
    const onChange = vi.fn();
    render(<SelectField label="Compare with" value="none" options={OPTIONS} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'Mon 2 Nov · 18:20');
    expect(onChange).toHaveBeenCalledWith('2');
  });
});
