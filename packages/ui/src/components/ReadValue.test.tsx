import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReadValue } from './ReadValue';
import { SelectField } from './SelectField';
import { TextField } from './TextField';

describe('ReadValue', () => {
  it('shows the value named by its label, a dash when empty', () => {
    render(
      <>
        <ReadValue label="Origin" value="Uganda" />
        <ReadValue label="Moisture" value=" " />
      </>,
    );
    expect(screen.getByLabelText('Origin')).toHaveTextContent('Uganda');
    expect(screen.getByLabelText('Moisture')).toHaveTextContent('–');
  });

  it('is what TextField and SelectField show when read only, with no field', () => {
    render(
      <>
        <TextField label="Supplier" value="Shop" readOnly onChange={() => undefined} />
        <SelectField
          label="Process"
          value="natural"
          options={[{ value: 'natural', label: 'Natural' }]}
          readOnly
          onChange={() => undefined}
        />
      </>,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByLabelText('Supplier')).toHaveTextContent('Shop');
    expect(screen.getByLabelText('Process')).toHaveTextContent('Natural');
  });
});
