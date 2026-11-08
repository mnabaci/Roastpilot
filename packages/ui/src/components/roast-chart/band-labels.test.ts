import { describe, expect, it } from 'vitest';
import { crossesAny, labelSpot, placeBandNames, type Box, type NamePlacement } from './band-labels';

const bottom: Box = { left: 40, top: 200, right: 120, bottom: 218 };
const top: Box = { left: 40, top: 120, right: 120, bottom: 138 };

describe('crossesAny', () => {
  it('sees a line running through the box, and one passing by', () => {
    expect(
      crossesAny(bottom, [
        [
          { x: 0, y: 210 },
          { x: 200, y: 210 },
        ],
      ]),
    ).toBe(true);
    expect(
      crossesAny(bottom, [
        [
          { x: 0, y: 100 },
          { x: 200, y: 100 },
        ],
      ]),
    ).toBe(false);
  });

  it('sees a steep segment that jumps across the box between two points', () => {
    expect(
      crossesAny(bottom, [
        [
          { x: 60, y: 150 },
          { x: 64, y: 260 },
        ],
      ]),
    ).toBe(true);
  });

  it('does not join across a break', () => {
    expect(crossesAny(bottom, [[{ x: 0, y: 150 }, null, { x: 200, y: 260 }]])).toBe(false);
  });
});

describe('labelSpot', () => {
  it('takes the bottom of the band when it is clear', () => {
    expect(
      labelSpot(
        [bottom, top],
        [
          [
            { x: 0, y: 100 },
            { x: 200, y: 100 },
          ],
        ],
      ),
    ).toBe(bottom);
  });

  it('moves to the top when a curve crosses the bottom, as the drop after charge does', () => {
    expect(
      labelSpot(
        [bottom, top],
        [
          [
            { x: 60, y: 150 },
            { x: 64, y: 260 },
          ],
        ],
      ),
    ).toBe(top);
  });

  it('names nothing when every spot is crossed', () => {
    expect(
      labelSpot(
        [bottom, top],
        [
          [
            { x: 0, y: 100 },
            { x: 200, y: 260 },
          ],
        ],
      ),
    ).toBeUndefined();
  });
});

describe('labelSpot with marker labels', () => {
  it('keeps clear of a marker label, taking the next free spot', () => {
    const charge: Box = { left: 30, top: 118, right: 90, bottom: 136 };
    const under: Box = { left: 40, top: 140, right: 120, bottom: 158 };
    const lines = [
      [
        { x: 60, y: 150 },
        { x: 64, y: 260 },
      ],
    ];
    expect(
      labelSpot(
        [bottom, top, under],
        [
          [
            { x: 0, y: 210 },
            { x: 200, y: 210 },
          ],
        ],
        [charge],
      ),
    ).toBe(under);
    expect(labelSpot([top], lines, [charge])).toBeUndefined();
  });
});

describe('placeBandNames', () => {
  // A plot 1000 wide: names start 8 right of Charge (x 100), or end 8 in from the right edge.
  const placement = (over: Partial<NamePlacement> = {}): NamePlacement => ({
    lefts: (width) => [108, 992 - width],
    height: 18,
    pad: 4,
    lines: [],
    taken: [],
    ...over,
  });
  const flat = (y: number, from = 0, to = 1000) => [
    { x: from, y },
    { x: to, y },
  ];

  it("centres each name in its own band's visible part, beside Charge", () => {
    expect(
      placeBandNames(
        [
          { top: 150, bottom: 250, width: 60 },
          { top: 0, bottom: 150, width: 70 },
        ],
        placement(),
      ),
    ).toEqual([
      { left: 108, right: 168, top: 191, bottom: 209 },
      { left: 108, right: 178, top: 66, bottom: 84 },
    ]);
  });

  it('moves to the top of its band, then its bottom, when a curve runs through the middle', () => {
    const band = { top: 100, bottom: 200, width: 60 };
    expect(placeBandNames([band], placement({ lines: [flat(150)] }))).toEqual([
      { left: 108, right: 168, top: 104, bottom: 122 },
    ]);
    expect(placeBandNames([band], placement({ lines: [flat(150), flat(110)] }))).toEqual([
      { left: 108, right: 168, top: 178, bottom: 196 },
    ]);
  });

  it('goes to the right edge when curves fill its band beside Charge', () => {
    const climbing = [
      { x: 100, y: 200 },
      { x: 400, y: 100 },
    ];
    expect(
      placeBandNames([{ top: 100, bottom: 200, width: 60 }], placement({ lines: [climbing] })),
    ).toEqual([{ left: 932, right: 992, top: 141, bottom: 159 }]);
  });

  it("keeps clear of the Charge label at the top of a band running to the axis's top", () => {
    // Maillard before first crack: from 150 °C to the top, under the Charge label's row.
    const charge: Box = { left: 108, right: 160, top: 0, bottom: 22 };
    const [spot] = placeBandNames(
      [{ top: 0, bottom: 40, width: 60 }],
      placement({ taken: [charge] }),
    );
    expect(spot).toEqual({ left: 932, right: 992, top: 11, bottom: 29 });
  });

  it('never puts a name on a marker line', () => {
    const firstCrack: Box = { left: 940, right: 942, top: 0, bottom: 300 };
    const centre: Box = { left: 108, right: 168, top: 0, bottom: 300 };
    expect(
      placeBandNames(
        [{ top: 100, bottom: 200, width: 60 }],
        placement({ taken: [centre, firstCrack] }),
      ),
    ).toEqual([undefined]);
  });

  it('never puts two names on top of each other', () => {
    // Two bands sharing their space (a first crack at dry end): the second finds another spot.
    const [a, b] = placeBandNames(
      [
        { top: 100, bottom: 200, width: 60 },
        { top: 100, bottom: 200, width: 60 },
      ],
      placement(),
    );
    expect(a).toEqual({ left: 108, right: 168, top: 141, bottom: 159 });
    expect(b).toEqual({ left: 108, right: 168, top: 104, bottom: 122 });
  });

  it('leaves a band too thin for its name, or with every spot taken, unnamed', () => {
    expect(placeBandNames([{ top: 100, bottom: 120, width: 60 }], placement())).toEqual([
      undefined,
    ]);
    const full: Box = { left: 0, right: 1000, top: 0, bottom: 300 };
    expect(
      placeBandNames([{ top: 100, bottom: 200, width: 60 }], placement({ taken: [full] })),
    ).toEqual([undefined]);
  });
});
