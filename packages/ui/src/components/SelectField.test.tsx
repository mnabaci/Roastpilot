import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

const OPTIONS = [
  { value: 'none', label: 'None' },
  { value: '2', label: 'Mon 2 Nov · 18:20', detail: 'Ethiopia Guji · ★★★★★' },
] as const;

describe('SelectField', () => {
  it('is a button named by its label, showing the value', () => {
    render(<SelectField label="Compare with" value="2" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Compare with' })).toHaveTextContent(
      'Mon 2 Nov · 18:20',
    );
  });

  it("shows the chosen option's badge beside its name, and each option's in the list", async () => {
    render(
      <SelectField
        label="Profile"
        value="mine"
        options={[
          { value: 'light', label: 'Light · Steps', detail: 'Built-in' },
          { value: 'mine', label: 'My light', badge: 'Needs calibration' },
        ]}
        onChange={vi.fn()}
      />,
    );
    const field = screen.getByRole('button', { name: 'Profile' });
    expect(field).toHaveTextContent(/^My light$/);
    await userEvent.click(field);
    expect(screen.getByRole('option', { name: /My light/ })).toHaveTextContent(
      'My lightNeeds calibration',
    );
    expect(screen.getByRole('option', { name: /Light · Steps/ })).not.toHaveTextContent(
      'Needs calibration',
    );
  });

  it('opens its list and reports the picked value', async () => {
    const onChange = vi.fn();
    render(<SelectField label="Compare with" value="none" options={OPTIONS} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Compare with' }));
    await userEvent.click(screen.getByRole('option', { name: /Mon 2 Nov/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2');
  });

  it('keeps its name with the label hidden, as in a table', () => {
    render(<SelectField label="Soak" value="2" options={OPTIONS} onChange={vi.fn()} hideLabel />);
    expect(screen.getByRole('button', { name: 'Soak' })).toHaveTextContent('Mon 2 Nov · 18:20');
  });

  it('stays shut while disabled', () => {
    render(
      <SelectField
        label="Compare with"
        value="none"
        options={OPTIONS}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Compare with' })).toBeDisabled();
  });
});
