import { describe, expect, it } from 'vitest';
import { plotPixelRatio } from './pixel-ratio';

const plot = (canvasWidth: number, width: number) =>
  ({ ctx: { canvas: { width: canvasWidth } }, width }) as unknown as Parameters<
    typeof plotPixelRatio
  >[0];

describe('plotPixelRatio', () => {
  it("is the ratio the plot's canvas was sized for, whatever the window says", () => {
    expect(plotPixelRatio(plot(2000, 1000))).toBe(2);
    expect(plotPixelRatio(plot(1000, 1000))).toBe(1);
    expect(plotPixelRatio(plot(1250, 1000))).toBe(1.25);
  });

  it('is 1 before the plot has a size', () => {
    expect(plotPixelRatio(plot(0, 0))).toBe(1);
    expect(plotPixelRatio(plot(0, 1000))).toBe(1);
  });
});
