import { describe, expect, it } from 'vitest';
import { spanPixels } from './draw-aids';
import { splitLayers } from './split-layers';

describe('spanPixels', () => {
  const toX = (t: number) => t * 2;

  it('puts a span’s edges in time order', () => {
    expect(spanPixels({ fromS: 100, toS: 40 }, toX, 0, 1000)).toEqual({ from: 80, to: 200 });
  });

  it('clips a span to the plot, and keeps a moment a single edge', () => {
    expect(spanPixels({ fromS: -50, toS: 700 }, toX, 10, 1000)).toEqual({ from: 10, to: 1000 });
    expect(spanPixels({ fromS: 300, toS: 300 }, toX, 0, 1000)).toEqual({ from: 600, to: 600 });
  });
});

describe('splitLayers', () => {
  it('draws a picked-out span through the outputs strip too, but not the phase bands', () => {
    const { stripOverlay, mainOverlay } = splitLayers(
      [
        { kind: 'time-span', id: 'finding', fromS: 300, toS: 360 },
        { kind: 'phase-bands', id: 'phases', bands: [] },
      ],
      [],
    );
    expect(mainOverlay.aids.map((a) => a.kind)).toEqual(['time-span', 'phase-bands']);
    expect(stripOverlay.aids.map((a) => a.kind)).toEqual(['time-span']);
  });
});
