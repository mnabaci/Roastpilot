import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TitleField } from './TitleField';

function Harness({ invalid = false }: { invalid?: boolean }) {
  const [value, setValue] = useState('Skywalker');
  return <TitleField value={value} onChange={setValue} invalid={invalid} />;
}

describe('TitleField', () => {
  it('is a text field named Name, holding the title', async () => {
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect(field).toHaveValue('Skywalker');
    await userEvent.clear(field);
    await userEvent.type(field, 'Popcorn');
    expect(field).toHaveValue('Popcorn');
  });

  it('says when its name has a problem', () => {
    render(<Harness invalid />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
  });
});
