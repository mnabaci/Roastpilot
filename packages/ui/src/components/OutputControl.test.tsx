import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OutputControl } from './OutputControl';

describe('OutputControl', () => {
  it('labels the slider and shows value and mode', () => {
    render(<OutputControl label="Heater" value={65} mode="auto" onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Heater' })).toHaveValue('65');
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('reports the new value as a number', () => {
    const onChange = vi.fn();
    render(<OutputControl label="Fan" value={30} mode="auto" onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Fan' }), { target: { value: '45' } });
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it('offers Resume auto only in manual mode', async () => {
    const onResumeAuto = vi.fn();
    const { rerender } = render(
      <OutputControl
        label="Heater"
        value={75}
        mode="auto"
        onChange={vi.fn()}
        onResumeAuto={onResumeAuto}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Resume auto' })).not.toBeInTheDocument();

    rerender(
      <OutputControl
        label="Heater"
        value={75}
        mode="manual"
        onChange={vi.fn()}
        onResumeAuto={onResumeAuto}
      />,
    );
    expect(screen.getByText('Manual')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume auto' }));
    expect(onResumeAuto).toHaveBeenCalledOnce();
  });
});
