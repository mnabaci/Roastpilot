import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip, TOOLTIP_DELAY_MS } from './Tooltip';

// Fake timers with synchronous events: Testing Library's async helpers wait on real timers.
function setup(onClick = vi.fn()) {
  render(
    <>
      <button type="button">Before</button>
      <Tooltip content="African Moon · Auto · Light · Steps · 5/5">
        <button type="button" onClick={onClick}>
          Row
        </button>
      </Tooltip>
    </>,
  );
  const wait = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };
  return { row: screen.getByRole('button', { name: 'Row' }), wait };
}

const tooltip = () => screen.queryByRole('tooltip');

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after the pointer rests on its trigger, and describes it', () => {
    const { row, wait } = setup();
    fireEvent.pointerOver(row);
    wait(TOOLTIP_DELAY_MS - 50);
    expect(tooltip()).toBeNull();
    wait(50);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('African Moon · Auto · Light · Steps · 5/5');
    expect(row).toHaveAttribute('aria-describedby', tip.id);
  });

  it('closes at once when the pointer leaves, and never opens if it left early', () => {
    const { row, wait } = setup();
    fireEvent.pointerOver(row);
    wait(100);
    fireEvent.pointerOut(row);
    wait(TOOLTIP_DELAY_MS);
    expect(tooltip()).toBeNull();
    fireEvent.pointerOver(row);
    wait(TOOLTIP_DELAY_MS);
    expect(tooltip()).not.toBeNull();
    fireEvent.pointerOut(row);
    expect(tooltip()).toBeNull();
    expect(row).not.toHaveAttribute('aria-describedby');
  });

  it('opens on keyboard focus, keeps focus on the trigger, and Escape closes it', () => {
    const { row, wait } = setup();
    act(() => {
      row.focus();
    });
    wait(TOOLTIP_DELAY_MS);
    expect(tooltip()).not.toBeNull();
    expect(row).toHaveFocus();
    fireEvent.keyDown(row, { key: 'Escape' });
    expect(tooltip()).toBeNull();
    expect(row).toHaveFocus();
  });

  it('closes when focus moves on', () => {
    const { row, wait } = setup();
    act(() => {
      row.focus();
    });
    wait(TOOLTIP_DELAY_MS);
    act(() => {
      screen.getByRole('button', { name: 'Before' }).focus();
    });
    expect(tooltip()).toBeNull();
  });

  it('a click does not open it, closes an open one, and still reaches the trigger', () => {
    const onClick = vi.fn();
    const { row, wait } = setup(onClick);
    fireEvent.pointerOver(row);
    wait(TOOLTIP_DELAY_MS);
    fireEvent.pointerDown(row);
    act(() => {
      row.focus();
    });
    fireEvent.click(row);
    expect(tooltip()).toBeNull();
    wait(TOOLTIP_DELAY_MS);
    expect(tooltip()).toBeNull();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
