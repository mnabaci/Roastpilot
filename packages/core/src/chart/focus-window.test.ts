import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import { focusWindow, savedRoastWindow, type TimeWindow } from './focus-window';

/** Drives the window through a roast second by second, as the chart redraws on each reading. */
function roastThrough(
  untilS: number,
  expectedEndS: (nowS: number) => number,
): { at: number; window: TimeWindow }[] {
  const clock = new ManualClock();
  const chargeMs = clock.now();
  const seen: { at: number; window: TimeWindow }[] = [];
  let window: TimeWindow | undefined;
  while (clock.now() - chargeMs <= untilS * 1000) {
    const nowS = (clock.now() - chargeMs) / 1000;
    window = focusWindow(window, { nowS, expectedEndS: expectedEndS(nowS) });
    seen.push({ at: nowS, window });
    clock.advance(1000);
  }
  return seen;
}

describe('focusWindow', () => {
  it('shows −0:30 to the expected end + 1:00 from Start', () => {
    expect(focusWindow(undefined, { nowS: 0, expectedEndS: 676 })).toEqual({
      fromS: -30,
      toS: 736,
    });
  });

  it('moves out smoothly to stay 1:00 ahead once the roast runs long, never in jumps', () => {
    const seen = roastThrough(900, () => 600);
    expect(seen.find((s) => s.at === 600)?.window.toS).toBe(660);
    expect(seen.find((s) => s.at === 601)?.window.toS).toBe(661);
    expect(seen.find((s) => s.at === 900)?.window.toS).toBe(960);
    seen.slice(1).forEach((s, i) => {
      const step = s.window.toS - (seen[i]?.window.toS ?? 0);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(1);
    });
  });

  it('never shrinks when the expected end moves earlier mid-roast', () => {
    // A ghost dropping at 9:00 picked at 2:00, where the 12:00 default was expected.
    const seen = roastThrough(300, (nowS) => (nowS < 120 ? 720 : 540));
    expect(seen.at(-1)?.window).toEqual({ fromS: -30, toS: 780 });
  });

  it('grows when the expected end moves later', () => {
    const first = focusWindow(undefined, { nowS: 60, expectedEndS: 600 });
    expect(focusWindow(first, { nowS: 61, expectedEndS: 700 }).toS).toBe(760);
  });
});

describe('savedRoastWindow', () => {
  it('runs from −0:30 to the cool end + 0:30', () => {
    expect(savedRoastWindow({ coolEndS: 900, dropS: 660 })).toEqual({ fromS: -30, toS: 930 });
  });

  it('runs to drop + 0:30 when cooling never ended', () => {
    expect(savedRoastWindow({ coolEndS: undefined, dropS: 660 })).toEqual({
      fromS: -30,
      toS: 690,
    });
  });

  it('shows everything when the roast has no end and no drop', () => {
    expect(savedRoastWindow({ coolEndS: undefined, dropS: undefined })).toBeUndefined();
  });
});
