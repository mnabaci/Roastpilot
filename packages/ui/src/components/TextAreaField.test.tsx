import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextAreaField } from './TextAreaField';

describe('TextAreaField', () => {
  it('is a labelled multi-line field: Enter adds a line', async () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Notes" value="Sweet" onChange={onChange} />);
    const field = screen.getByRole('textbox', { name: 'Notes' });
    expect(field.tagName).toBe('TEXTAREA');
    await userEvent.type(field, '{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('Sweet\n');
  });

  it('passes blur on, so a form can save when you leave it', async () => {
    const onBlur = vi.fn();
    render(<TextAreaField label="Notes" value="" onChange={() => undefined} onBlur={onBlur} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Notes' }));
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
