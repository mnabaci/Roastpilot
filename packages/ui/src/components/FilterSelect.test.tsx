import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './FilterSelect';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'Ethiopia Guji' },
];

describe('FilterSelect', () => {
  it('shows the label and the choice when nothing marks "all"', () => {
    render(<FilterSelect label="Compare" options={OPTIONS} value="all" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Compare' });
    expect(select).toHaveValue('all');
    expect(select.parentElement).toHaveTextContent('Compare: All');
  });

  it('as a filter: its name until it filters, then the choice', () => {
    const { rerender } = render(
      <FilterSelect label="Bean" allValue="all" options={OPTIONS} value="all" onChange={vi.fn()} />,
    );
    const chip = () => screen.getByRole('combobox', { name: 'Bean' }).parentElement;
    expect(chip()).toHaveTextContent(/^Bean/);
    rerender(
      <FilterSelect label="Bean" allValue="all" options={OPTIONS} value="1" onChange={vi.fn()} />,
    );
    expect(chip()).toHaveTextContent(/^Ethiopia Guji/);
  });

  it('picks with the native select', async () => {
    const onChange = vi.fn();
    render(<FilterSelect label="Bean" options={OPTIONS} value="all" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Bean' }), '1');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1');
  });
});
