import { READY_ROAST, type Reading, type RoastState } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { DUMP_PROMPT_MS, roastStripData } from './roast-strip-data';

const reading = (atMs: number, values: Reading['values']): Reading => ({ atMs, values });
const roast = (patch: Partial<RoastState>): RoastState => ({ ...READY_ROAST, ...patch });

describe('roastStripData', () => {
  it('nothing in Ready or Done', () => {
    expect(roastStripData(READY_ROAST, [reading(0, { bt: 22 })])).toBeUndefined();
    expect(roastStripData(roast({ phase: 'done' }), [])).toBeUndefined();
  });

  it('roasting: phase and clock, then BT, RoR, heater and fan', () => {
    const readings = Array.from({ length: 31 }, (_, i) =>
      reading(432_000 + i * 1000, { bt: 180 + i * 0.1, heater: 60, fan: 40 }),
    );
    const data = roastStripData(roast({ phase: 'roasting', chargedAtMs: 0 }), readings);
    expect(data?.lead).toBe('Roasting · 7:42');
    expect(data?.prompt).toBeUndefined();
    expect(data?.numbers).toEqual([
      { label: 'Temp', value: '183.0 °C' },
      { label: 'RoR', value: '6.0' },
      { label: 'Heater', value: '60 %' },
      { label: 'Fan', value: '40 %' },
    ]);
  });

  it('preheat counts its own time; missing values stay undefined for a dash', () => {
    const data = roastStripData(roast({ phase: 'preheat', preheatAtMs: 0 }), [
      reading(150_000, {}),
    ]);
    expect(data?.lead).toBe('Preheat · 2:30');
    expect(data?.numbers.every((n) => n.value === undefined)).toBe(true);
  });

  it('cooling: Dump beans leads for the first minute, then quiet', () => {
    const cooling = roast({
      phase: 'cooling',
      chargedAtMs: 0,
      droppedAtMs: 600_000,
      coolingEndsAtMs: 840_000,
    });
    const early = roastStripData(cooling, [reading(602_000, { bt: 196.2 })]);
    expect(early?.prompt).toBe('Dump beans · Cooling beans 3:58 left');
    expect(early?.numbers).toEqual([{ label: 'Temp', value: '196.2 °C' }]);
    const later = roastStripData(cooling, [reading(600_000 + DUMP_PROMPT_MS, { bt: 120 })]);
    expect(later?.prompt).toBeUndefined();
    expect(later?.lead).toBe('Cooling beans 3:00 left');
  });

  it('drum cooling after the beans: where the drum is heading', () => {
    const data = roastStripData(
      roast({ phase: 'done', roasterCoolingSinceMs: 0, roasterCoolToC: 50 }),
      [reading(1000, { bt: 92.4, fan: 100 })],
    );
    expect(data?.lead).toBe('Cooling the drum · 92 °C → 50 °C');
    expect(data?.numbers).toEqual([
      { label: 'Temp', value: '92.4 °C' },
      { label: 'Fan', value: '100 %' },
    ]);
  });

  it('while the beans cool, their countdown leads even with the drum cooling beside them', () => {
    const data = roastStripData(
      roast({
        phase: 'cooling',
        droppedAtMs: 0,
        coolingEndsAtMs: 240_000,
        roasterCoolingSinceMs: 0,
        roasterCoolToC: 50,
      }),
      [reading(120_000, { bt: 112.4 })],
    );
    expect(data?.lead).toBe('Cooling beans 2:00 left');
  });

  it('names the temperature as the connected roaster does', () => {
    const data = roastStripData(
      roast({ phase: 'roasting', chargedAtMs: 0 }),
      [reading(60_000, { bt: 150 })],
      'BT',
    );
    expect(data?.numbers[0]).toEqual({ label: 'BT', value: '150.0 °C' });
  });
});
