import { READY_ROAST } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { roastChartData } from './roast-chart-data';

const RAW = { smoothingS: 0 };

describe('roastChartData outputs strip', () => {
  it('draws an on/off drum at 0 or 100%, and a drum speed as it is', () => {
    const drumOf = (values: number[]) =>
      roastChartData(
        READY_ROAST,
        values.map((drum, i) => ({ atMs: i * 1_000, values: { bt: 100, drum } })),
        RAW,
      ).layers.find((l) => l.id === 'drum');
    expect(drumOf([0, 1, 1])).toMatchObject({
      label: 'Drum',
      axis: 'output',
      tone: 'neutral',
      step: true,
      points: [
        { t: 0, v: 0 },
        { t: 1, v: 100 },
        { t: 2, v: 100 },
      ],
    });
    expect(drumOf([60, 60])?.points).toEqual([
      { t: 0, v: 60 },
      { t: 1, v: 60 },
    ]);
  });

  it('has no drum line when no reading has the drum', () => {
    const { layers } = roastChartData(READY_ROAST, [{ atMs: 0, values: { bt: 100 } }], RAW);
    expect(layers.map((l) => l.id)).not.toContain('drum');
  });

  it('heater and fan as step layers for the strip, skipping readings without them', () => {
    const { layers } = roastChartData(
      READY_ROAST,
      [
        { atMs: 0, values: { bt: 100, heater: 100, fan: 30 } },
        { atMs: 1_000, values: { bt: 101 } },
        { atMs: 2_000, values: { bt: 102, heater: 70, fan: 30 } },
      ],
      RAW,
    );
    const byId = Object.fromEntries(layers.map((l) => [l.id, l]));
    expect(byId.heater).toMatchObject({
      axis: 'output',
      tone: 'heat',
      step: true,
      points: [
        { t: 0, v: 100 },
        { t: 2, v: 70 },
      ],
    });
    expect(byId.fan).toMatchObject({
      axis: 'output',
      tone: 'air',
      step: true,
      points: [
        { t: 0, v: 30 },
        { t: 2, v: 30 },
      ],
    });
  });
});
