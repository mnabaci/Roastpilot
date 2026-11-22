import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InfoButton } from './InfoButton';

describe('InfoButton', () => {
  it('opens its lines on click, named by what it explains, and closes with Escape', async () => {
    render(<InfoButton label="About spec sheets" lines={['What it does.', 'What it sends.']} />);
    expect(screen.queryByText('What it does.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'About spec sheets' }));
    const panel = await screen.findByRole('dialog', { name: 'About spec sheets' });
    expect(panel).toHaveTextContent('What it does.What it sends.');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'About spec sheets' })).toHaveFocus();
  });

  it('ends with one way to read more, which closes it', async () => {
    const onSelect = vi.fn();
    render(
      <InfoButton
        label="About Process"
        lines={['Natural: dried in the fruit.']}
        more={{ label: 'Roasting cheat sheet', onSelect }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'About Process' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Roasting cheat sheet' }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
