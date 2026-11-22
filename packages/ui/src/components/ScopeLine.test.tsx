import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ScopeLine } from './ScopeLine';

describe('ScopeLine', () => {
  it('picks whose list it is, named for screen readers by what it picks', async () => {
    const onChange = vi.fn();
    render(
      <ScopeLine
        label="Roaster"
        value="active"
        options={[
          { value: 'active', label: 'Skywalker', detail: '12 roasts' },
          { value: 'all', label: 'All roasters', detail: '14 roasts' },
        ]}
        onChange={onChange}
      />,
    );
    const button = screen.getByRole('button', { name: 'Roaster: Skywalker' });
    await userEvent.click(button);
    await userEvent.click(await screen.findByRole('option', { name: /^All roasters/ }));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('reads as text when there is nothing to choose here', () => {
    render(<ScopeLine label="Roaster" text="Skywalker" tooltip="Change it in Roasters" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Skywalker').parentElement).toHaveTextContent(
      'Roaster: Skywalker · Change it in Roasters',
    );
  });
});
