import { describe, expect, it } from 'vitest';
import { manualRoastHarness } from './manual-roast.harness';

/** Preheat climbing, then the charge drop, then the beans still falling. */
const PREHEAT = Array.from({ length: 20 }, (_, i) => 180 + i * 0.3);
const DROP = [186.4, 181.5, 177.5, 171.6, 165.0];

describe('ManualRoast charge point', () => {
  it('moves charge back to the reading before the charge drop', async () => {
    const { clock, roast, signals, entries, act, feed } = manualRoastHarness();
    await act('preheat');
    await feed([...PREHEAT, ...DROP]);
    const pressedAtMs = clock.now();
    await act('start');
    // 186.4 °C came 4 readings before the press.
    const chargedAtMs = pressedAtMs - 4000;
    expect(roast.state).toMatchObject({
      chargedAtMs,
      startPressedAtMs: pressedAtMs,
      events: [{ kind: 'charge', atMs: chargedAtMs, bt: 186.4 }],
    });
    expect(signals).toContain(`roast-started@${String(chargedAtMs)}`);
    expect(entries.find((e) => e.event === 'roast.charge-found')?.context).toEqual({
      earlierMs: 4000,
    });
  });

  it('uses the press when there is no clear drop, or when the setting is off', async () => {
    const plain = manualRoastHarness();
    await plain.act('preheat');
    await plain.feed(PREHEAT);
    await plain.act('start');
    expect(plain.roast.state.chargedAtMs).toBe(plain.clock.now());
    expect(plain.roast.state.events[0]?.bt).toBe(PREHEAT.at(-1));

    const off = manualRoastHarness({ options: { findChargePoint: false } });
    await off.act('preheat');
    await off.feed([...PREHEAT, ...DROP]);
    await off.act('start');
    expect(off.roast.state.chargedAtMs).toBe(off.clock.now());
    expect(off.entries.some((e) => e.event === 'roast.charge-found')).toBe(false);
  });

  it('never looks before Preheat', async () => {
    const { roast, clock, act, feed, readings } = manualRoastHarness();
    await feed([...PREHEAT, ...DROP]);
    const kept = [...readings];
    await act('preheat');
    // Main clears at Preheat; keep the old drop around to prove it isn't used anyway.
    readings.push(...kept);
    await feed([170, 171, 172, 173, 174, 175]);
    await act('start');
    expect(roast.state.chargedAtMs).toBe(clock.now());
  });
});

describe('ManualRoast turning point', () => {
  /** After charge: falls from 180 to 92 °C over 60 s, then rises. */
  const DIP = [
    ...Array.from({ length: 60 }, (_, i) => 180 - (88 * (i + 1)) / 60),
    92.5,
    93,
    93.5,
    94,
  ];

  it('is recorded once while roasting, with its time and BT', async () => {
    const { roast, states, entries, signals, act, feed } = manualRoastHarness();
    await act('start');
    const chargedAtMs = roast.state.chargedAtMs ?? 0;
    await feed(DIP);
    const tp = roast.state.events.filter((e) => e.kind === 'turning-point');
    expect(tp).toEqual([{ kind: 'turning-point', atMs: chargedAtMs + 60_000, bt: 92 }]);
    // Tells the safety monitor, so the stall alarm watches from here.
    expect(signals.filter((s) => s.startsWith('turning-point@'))).toEqual([
      `turning-point@${String(chargedAtMs + 60_000)}`,
    ]);
    expect(entries.find((e) => e.event === 'roast.turning-point')?.context).toEqual({
      afterChargeMs: 60_000,
      bt: 92,
    });
    const published = states.length;
    await feed([95, 96, 97, 98, 99]);
    expect(roast.state.events.filter((e) => e.kind === 'turning-point')).toHaveLength(1);
    expect(states).toHaveLength(published);
  });

  it('is not looked for in Preheat, or after first crack', async () => {
    const preheat = manualRoastHarness();
    await preheat.act('preheat');
    await preheat.feed(DIP);
    expect(preheat.roast.state.events).toEqual([]);

    const late = manualRoastHarness();
    await late.act('start', 'first-crack');
    await late.feed(DIP);
    expect(late.roast.state.events.some((e) => e.kind === 'turning-point')).toBe(false);
  });
});
