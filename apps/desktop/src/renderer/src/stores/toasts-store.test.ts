import { describe, expect, it } from 'vitest';
import { addToast, removeToast, type ToastsData } from './toasts-store';

const empty: ToastsData = { toasts: [], lastId: 0 };
const texts = (data: ToastsData) => data.toasts.map((t) => t.text);

describe('toasts store', () => {
  it('adds newest last and keeps three', () => {
    let data = empty;
    for (const text of ['a', 'b', 'c', 'd']) data = addToast(data, 'error', text);
    expect(texts(data)).toEqual(['b', 'c', 'd']);
  });

  it('moves a repeated line to the bottom instead of stacking it twice', () => {
    let data = addToast(empty, 'error', 'a');
    data = addToast(data, 'error', 'b');
    data = addToast(data, 'error', 'a');
    expect(texts(data)).toEqual(['b', 'a']);
  });

  it('removes one by id', () => {
    const data = addToast(addToast(empty, 'error', 'a'), 'info', 'b');
    const first = data.toasts[0];
    expect(first).toBeDefined();
    expect(texts(removeToast(data, first?.id ?? ''))).toEqual(['b']);
  });
});
