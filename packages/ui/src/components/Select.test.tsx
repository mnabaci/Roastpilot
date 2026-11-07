import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Select, type SelectOption } from './Select';

const BEANS: SelectOption<string>[] = [
  { value: 'none', label: 'No bean' },
  { value: '1', label: 'Ethiopia Guji', detail: '300 g · Ethiopia · washed' },
  { value: '2', label: 'Colombia Huila', detail: '1.2 kg · Colombia · natural' },
  { value: '3', label: 'Kenya AA', disabled: true },
];

const MANY: SelectOption<string>[] = Array.from({ length: 9 }, (_, i) => ({
  value: String(i),
  label: `Roast ${String(i + 1)}`,
  detail: i === 4 ? 'Ethiopia Guji' : 'Colombia Huila',
}));

function Picker({
  options = BEANS,
  start = 'none',
  onChange = vi.fn(),
}: {
  options?: SelectOption<string>[];
  start?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(start);
  return (
    <Select
      label="Bean"
      value={value}
      options={options}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    >
      {options.find((o) => o.value === value)?.label}
    </Select>
  );
}

const open = () => userEvent.click(screen.getByRole('button', { name: /No bean|Ethiopia|Roast/ }));

describe('Select', () => {
  it('opens a list with the chosen option ticked and details under names', async () => {
    render(<Picker start="1" />);
    const trigger = screen.getByRole('button', { name: 'Ethiopia Guji' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Bean' })).toBeInTheDocument();
    const chosen = screen.getByRole('option', { name: /Ethiopia Guji/ });
    expect(chosen).toHaveAttribute('aria-selected', 'true');
    expect(chosen).toHaveTextContent('300 g · Ethiopia · washed');
    expect(screen.getByRole('option', { name: 'No bean' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('picks with a click, closes, and hands focus back', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('option', { name: /Colombia Huila/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Colombia Huila' })).toHaveFocus();
  });

  it('arrows move, Enter picks, Escape closes without picking', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await open();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'No bean' })).toHaveFocus();
    await open();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1');
  });

  it('typing a letter jumps to the first option starting with it', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await open();
    await userEvent.keyboard('c{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2');
  });

  it('skips a disabled option', async () => {
    const onChange = vi.fn();
    render(<Picker onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('option', { name: 'Kenya AA' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has no search for 8 options or fewer', async () => {
    render(<Picker options={MANY.slice(0, 8)} start="0" />);
    await open();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('searches a longer list by name and detail; Enter picks the first match', async () => {
    const onChange = vi.fn();
    render(<Picker options={MANY} start="0" onChange={onChange} />);
    await open();
    const search = screen.getByRole('combobox', { name: 'Search Bean' });
    expect(search).toHaveFocus();
    await userEvent.type(search, 'guji');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('4');
  });

  it('says No match when nothing fits', async () => {
    render(<Picker options={MANY} start="0" />);
    await open();
    await userEvent.type(screen.getByRole('combobox', { name: 'Search Bean' }), 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('does not open while disabled', async () => {
    render(
      <Select label="Bean" value="none" options={BEANS} onChange={vi.fn()} disabled>
        No bean
      </Select>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'No bean' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
