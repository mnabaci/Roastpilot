import { describe, expect, it } from 'vitest';
import { READY_ROAST } from '../../stores/roast-store';
import { stageTimes } from './stage-times';

describe('stageTimes', () => {
  it('nothing before a stage is over', () => {
    expect(stageTimes({ ...READY_ROAST, phase: 'preheat', preheatAtMs: 0 })).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('every finished stage, with development as a share of the roast', () => {
    expect(
      stageTimes({
        ...READY_ROAST,
        phase: 'done',
        preheatAtMs: 0,
        chargedAtMs: 250_000,
        firstCrackAtMs: 630_000,
        droppedAtMs: 720_000,
        events: [{ kind: 'cool-end', atMs: 960_000, bt: 40 }],
      }),
    ).toEqual(['4:10', '6:20', '1:30 · 19%', undefined, '4:00']);
  });

  it('a drop before first crack ends the Roast stage; no preheat when it was skipped', () => {
    expect(
      stageTimes({ ...READY_ROAST, phase: 'cooling', chargedAtMs: 0, droppedAtMs: 300_000 }),
    ).toEqual([undefined, '5:00', undefined, undefined, undefined]);
  });
});
