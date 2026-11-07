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
    expect(screen.getByRole('button', { name: 'Compare: All' })).toHaveTextContent('Compare: All');
  });

  it('is named by its label alone when the value is not in the list', () => {
    render(<FilterSelect label="Bean" options={OPTIONS} value="gone" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Bean' })).toBeInTheDocument();
  });

  it('as a filter: its name until it filters, then the choice', () => {
    const { rerender } = render(
      <FilterSelect label="Bean" allValue="all" options={OPTIONS} value="all" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Bean: All' })).toHaveTextContent(/^Bean$/);
    rerender(
      <FilterSelect label="Bean" allValue="all" options={OPTIONS} value="1" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Bean: Ethiopia Guji' })).toHaveTextContent(
      /^Ethiopia Guji$/,
    );
  });

  it('picks from its list', async () => {
    const onChange = vi.fn();
    render(<FilterSelect label="Bean" options={OPTIONS} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bean: All' }));
    await userEvent.click(screen.getByRole('option', { name: 'Ethiopia Guji' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1');
  });
});
