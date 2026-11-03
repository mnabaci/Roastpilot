import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from './throttle';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('throttle', () => {
  it('sends the first value at once, then only the latest after the gap', () => {
    const send = vi.fn();
    const t = throttle(send, 150);
    t.push(10);
    t.push(15);
    t.push(20);
    expect(send.mock.calls).toEqual([[10]]);
    vi.advanceTimersByTime(150);
    expect(send.mock.calls).toEqual([[10], [20]]);
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends at once again after a quiet gap', () => {
    const send = vi.fn();
    const t = throttle(send, 150);
    t.push(1);
    vi.advanceTimersByTime(400);
    t.push(2);
    expect(send.mock.calls).toEqual([[1], [2]]);
  });

  it('cancel drops what is queued', () => {
    const send = vi.fn();
    const t = throttle(send, 150);
    t.push(1);
    t.push(2);
    t.cancel();
    vi.advanceTimersByTime(500);
    expect(send.mock.calls).toEqual([[1]]);
  });
});
