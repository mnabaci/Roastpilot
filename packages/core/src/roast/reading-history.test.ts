import { describe, expect, it } from 'vitest';
import { MAX_HISTORY_READINGS, ReadingHistory } from './reading-history';

describe('ReadingHistory', () => {
  it('keeps readings in order and clears them', () => {
    const history = new ReadingHistory();
    history.add({ atMs: 0, values: { bt: 20 } });
    history.add({ atMs: 1000, values: { bt: 21 } });
    expect(history.latest()?.values.bt).toBe(21);
    expect(history.all()).toHaveLength(2);
    history.clear();
    expect(history.all()).toEqual([]);
    expect(history.latest()).toBeUndefined();
  });

  it('drops the oldest readings past the cap', () => {
    const history = new ReadingHistory();
    for (let i = 0; i < MAX_HISTORY_READINGS + 5; i++) history.add({ atMs: i, values: {} });
    expect(history.all()).toHaveLength(MAX_HISTORY_READINGS);
    expect(history.all()[0]?.atMs).toBe(5);
  });
});
