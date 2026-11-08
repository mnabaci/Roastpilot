import { describe, expect, it } from 'vitest';
import { unitReader } from './unit-reader';

describe('unitReader', () => {
  it('reads °F to °C, a temperature with − 32 and a rate without', () => {
    const read = unitReader('f');
    expect(read.temp('a', '392')).toBe(200);
    expect(read.rate('b', '18')).toBe(10);
    expect(read.errors).toEqual({});
  });

  it('gives an untouched value back exactly, not rounded through °F', () => {
    const read = unitReader('f', { temps: [92], rates: [7.7] });
    // 92 °C shows as 198 °F, which alone would read back as 92.2 °C.
    expect(read.temp('a', '198')).toBe(92);
    expect(read.rate('b', '13.9')).toBe(7.7);
    expect(read.temp('c', '199')).toBe(92.8);
  });

  it('says a cell that is not a number', () => {
    const read = unitReader('f');
    read.temp('a', 'hot');
    expect(read.errors).toEqual({ a: 'Enter a number' });
  });

  it('gives the first of two values that show the same back, never the other', () => {
    // 204.4 and 204.5 °C both show as 400 °F.
    const read = unitReader('f', { temps: [204.4, 204.5], rates: [] });
    expect(read.temp('cap', '400')).toBe(204.4);
  });
});
