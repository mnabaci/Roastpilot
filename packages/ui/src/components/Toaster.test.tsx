import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_FADE_MS, TOAST_SHOW_MS, Toaster, type ToastMessage } from './Toaster';

const error: ToastMessage = {
  id: '1',
  kind: 'error',
  text: "Couldn't delete the roast · try again",
};
const info: ToastMessage = { id: '2', kind: 'info', text: 'Copied' };

describe('Toaster', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces an error as an alert and info as a status', () => {
    render(<Toaster toasts={[error, info]} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete the roast · try again");
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('dismisses with the × button', async () => {
    const onDismiss = vi.fn();
    render(<Toaster toasts={[error]} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('1');
  });

  it('shows at most three, newest last', () => {
    const toasts = ['a', 'b', 'c', 'd'].map((id) => ({ id, kind: 'error' as const, text: id }));
    render(<Toaster toasts={toasts} onDismiss={vi.fn()} />);
    expect(screen.getAllByRole('alert').map((t) => t.textContent)).toEqual(['b', 'c', 'd']);
  });

  it('fades an info toast after its time', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toaster toasts={[info]} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(TOAST_SHOW_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(onDismiss).toHaveBeenCalledWith('2');
  });

  it('keeps an error until it is dismissed', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toaster toasts={[error]} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(TOAST_SHOW_MS * 10);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('waits while hovered or focused, then runs its full time again', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toaster toasts={[info]} onDismiss={onDismiss} />);
    const toast = screen.getByRole('status');
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_SHOW_MS * 2);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(toast);
    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_SHOW_MS * 2);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_SHOW_MS);
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(onDismiss).toHaveBeenCalledWith('2');
  });

  it("doesn't restart the timer when the parent re-renders", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const view = render(<Toaster toasts={[info]} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(TOAST_SHOW_MS - 100);
    });
    view.rerender(
      <Toaster
        toasts={[info]}
        onDismiss={(id) => {
          onDismiss(id);
        }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_FADE_MS);
    });
    expect(onDismiss).toHaveBeenCalledWith('2');
  });
});
