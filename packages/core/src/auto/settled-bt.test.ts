import { describe, expect, it } from 'vitest';
import { SettledBt } from './settled-bt';

const feed = (values: readonly (number | undefined)[]) => {
  const settled = new SettledBt();
  return values.map((v) => settled.next(v));
};

describe('SettledBt', () => {
  it('ignores one bad reading', () => {
    expect(feed([196, 197, 230, 197])).toEqual([196, 196, 197, 197]);
  });

  it('follows a temperature that holds for two of three readings', () => {
    expect(feed([198, 200, 201]).at(-1)).toBe(200);
  });

  it('takes the lowest until there are three', () => {
    expect(feed([150, 240])).toEqual([150, 150]);
  });

  it('has nothing to say for a reading without BT, and keeps the ones before', () => {
    expect(feed([150, undefined, Number.NaN, 151, 152])).toEqual([
      150,
      undefined,
      undefined,
      150,
      151,
    ]);
  });
});
