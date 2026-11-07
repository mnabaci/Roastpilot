import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KEYBOARD_COMMIT_MS, OutputControl } from './OutputControl';

describe('OutputControl', () => {
  it('labels the slider and shows value and mode', () => {
    render(<OutputControl label="Heater" value={65} mode="auto" onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Heater' })).toHaveValue('65');
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('shows no badge and no Resume auto in a manual roast', () => {
    render(<OutputControl label="Fan" value={30} onChange={vi.fn()} onResumeAuto={vi.fn()} />);
    expect(screen.queryByText('Manual')).toBeNull();
    expect(screen.queryByText('Auto')).toBeNull();
    expect(screen.queryByRole('button', { name: /Resume auto/ })).toBeNull();
  });

  it('shows a dash and locks the slider when there is no value', () => {
    render(<OutputControl label="Heater" value={undefined} mode="manual" onChange={vi.fn()} />);
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
  });

  it('shows a dash, never NaN, for a reading that is not a number', () => {
    render(<OutputControl label="Heater" value={Number.NaN} onChange={vi.fn()} />);
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Heater' })).toBeDisabled();
  });

  it('while dragging only the number moves; letting go sends the value once', () => {
    const onChange = vi.fn();
    render(<OutputControl label="Fan" value={30} mode="auto" onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Fan' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.change(slider, { target: { value: '60' } });
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(60);
  });

  it('letting go outside the slider still sends', () => {
    const onChange = vi.fn();
    render(<OutputControl label="Fan" value={30} mode="auto" onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Fan' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.pointerUp(document.body);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(45);
  });

  it('a cancelled pointer ends the drag and sends, so keys after it still send', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<OutputControl label="Fan" value={30} mode="auto" onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Fan' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '45' } });
    fireEvent.pointerCancel(window);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(45);
    fireEvent.change(slider, { target: { value: '50' } });
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenLastCalledWith(50);
    vi.useRealTimers();
  });

  it('with the keyboard, sends 300 ms after the last key', () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(<OutputControl label="Fan" value={30} mode="auto" onChange={onChange} />);
      const slider = screen.getByRole('slider', { name: 'Fan' });
      fireEvent.change(slider, { target: { value: '35' } });
      act(() => {
        vi.advanceTimersByTime(KEYBOARD_COMMIT_MS - 1);
      });
      fireEvent.change(slider, { target: { value: '40' } });
      act(() => {
        vi.advanceTimersByTime(KEYBOARD_COMMIT_MS - 1);
      });
      expect(onChange).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onChange).toHaveBeenCalledExactlyOnceWith(40);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaving the slider sends what is pending at once, and nothing when unchanged', () => {
    const onChange = vi.fn();
    render(<OutputControl label="Fan" value={30} mode="auto" onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Fan' });
    fireEvent.blur(slider);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(slider, { target: { value: '50' } });
    fireEvent.blur(slider);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(50);
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '30' } });
    fireEvent.pointerUp(window);
    expect(onChange).toHaveBeenCalledOnce();
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

  it('sends nothing when it goes away mid-drag', () => {
    const onChange = vi.fn();
    const { unmount } = render(<OutputControl label="Fan" value={30} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Fan' });
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '45' } });
    unmount();
    fireEvent.pointerUp(window);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a delayed send uses the latest onChange and skips a value the roaster already reports', () => {
    vi.useFakeTimers();
    try {
      const first = vi.fn();
      const latest = vi.fn();
      const { rerender } = render(<OutputControl label="Fan" value={30} onChange={first} />);
      const slider = screen.getByRole('slider', { name: 'Fan' });
      fireEvent.change(slider, { target: { value: '35' } });
      rerender(<OutputControl label="Fan" value={30} onChange={latest} />);
      act(() => {
        vi.advanceTimersByTime(KEYBOARD_COMMIT_MS);
      });
      expect(first).not.toHaveBeenCalled();
      expect(latest).toHaveBeenCalledExactlyOnceWith(35);

      fireEvent.change(slider, { target: { value: '40' } });
      rerender(<OutputControl label="Fan" value={40} onChange={latest} />);
      act(() => {
        vi.advanceTimersByTime(KEYBOARD_COMMIT_MS);
      });
      expect(latest).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
