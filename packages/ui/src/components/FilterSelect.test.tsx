import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './FilterSelect';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'Ethiopia Guji' },
];

describe('FilterSelect', () => {
  it('shows what it filters and the choice, and is a named select', () => {
    render(<FilterSelect label="Bean" options={OPTIONS} value="all" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Bean' });
    expect(select).toHaveValue('all');
    expect(select.parentElement).toHaveTextContent('Bean: All');
  });

  it('picks with the native select', async () => {
    const onChange = vi.fn();
    render(<FilterSelect label="Bean" options={OPTIONS} value="all" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Bean' }), '1');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1');
  });
});
