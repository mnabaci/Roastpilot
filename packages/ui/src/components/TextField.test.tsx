import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

function Controlled({
  onChange = vi.fn(),
  initial = '',
}: {
  onChange?: (v: string) => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TextField
      label="Search"
      type="search"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('TextField', () => {
  it('is a labelled input that reports what you type', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'fail');
    expect(onChange).toHaveBeenLastCalledWith('fail');
  });

  it('Escape clears a search', async () => {
    render(<Controlled initial="connect" />);
    const field = screen.getByRole('searchbox', { name: 'Search' });
    await userEvent.type(field, '{Escape}');
    expect(field).toHaveValue('');
  });

  it('shows Clear only while there is text', async () => {
    render(<Controlled initial="x" />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('a plain text field has no search extras', () => {
    render(<TextField label="Bean" value="Kenya" onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Bean' })).toHaveValue('Kenya');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
