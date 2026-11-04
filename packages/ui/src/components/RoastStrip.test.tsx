import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoastStrip } from './RoastStrip';

const numbers = [
  { label: 'BT', value: '182.4 °C' },
  { label: 'RoR', value: undefined },
];

describe('RoastStrip', () => {
  it('leads with the phase and its clock, then the numbers; a missing one is a dash', () => {
    render(<RoastStrip lead="Roasting · 7:42" numbers={numbers} onOpen={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('Roasting · 7:42BT 182.4 °CRoR –');
  });

  it('a prompt from the flow leads instead of the phase', () => {
    render(
      <RoastStrip
        lead="Cooling · 0:02"
        prompt="Dump beans · Cooling 3:58 left"
        numbers={numbers}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent(/^Dump beans · Cooling 3:58 left/);
    expect(screen.queryByText('Cooling · 0:02')).not.toBeInTheDocument();
  });

  it('opens Roast when pressed', async () => {
    const onOpen = vi.fn();
    render(<RoastStrip lead="Preheat · 2:30" numbers={[]} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
