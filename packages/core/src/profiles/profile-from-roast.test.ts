import type { RoastDetail, SavedSample } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { profileFromRoast } from './profile-from-roast';
import { simplifyCurve } from './simplify-curve';

/** Ten minutes: dips, then climbs with the heater and fan changing at 60, 200 and 400 s. */
function run(): SavedSample[] {
  const samples: SavedSample[] = [{ tS: -5, values: { bt: 180, heater: 90, fan: 30 } }];
  for (let tS = 0; tS <= 600; tS += 2) {
    const bt = tS < 60 ? 180 - tS : 120 + (tS - 60) * 0.15;
    const heater = tS < 60 ? 0 : tS < 200 ? 80 : tS < 400 ? 60 : 40;
    const fan = tS < 200 ? 30 : tS < 400 ? 50 : 70;
    samples.push({ tS, values: { bt, heater, fan } });
  }
  return samples;
}

const ROAST: RoastDetail = {
  id: 7,
  startedAt: '2026-11-04T10:00:00.000Z',
  endedAt: '2026-11-04T10:15:00.000Z',
  fcTimeS: 500,
  dropTimeS: 600,
  dropTemp: 201,
  roasterId: 1,
  beanId: null,
  ghostRoastId: null,
  batchG: 375,
  roastedG: 320,
  rating: 5,
  isFavourite: true,
  notes: null,
  profileId: null,
  profileName: null,
  imported: false,
  mode: 'manual',
  profile: null,
  samples: run(),
  events: [{ kind: 'charge', tS: 0, bt: 180 }],
};

const make = (roast: RoastDetail, style: 'steps' | 'curve' = 'steps') =>
  profileFromRoast({ roast, style, id: 'custom-1', fallbackBatchG: 385 });

describe('profileFromRoast', () => {
  it('takes steps from the heat and fan changes that ran', () => {
    const profile = make(ROAST);
    expect(profile?.phases.map((p) => p.name)).toEqual([
      'Soak',
      'Step 1',
      'Step 2',
      'Step 3',
      'Development',
    ]);
    expect(profile?.phases[0]).toMatchObject({ next: { on: 'time', afterS: 60 }, fanPct: 30 });
    expect(profile?.phases[1]).toMatchObject({
      fanPct: 30,
      next: { on: 'bt', c: 141, backupS: 260 },
      heat: { mode: 'target', pct: 80, endC: 141, durationS: 140, rorMin: 8, rorMax: 10 },
    });
    expect(profile?.phases[3]).toMatchObject({ fanPct: 70, heat: { pct: 40 } });
    expect(profile?.phases.at(-1)).toMatchObject({ next: { on: 'end' }, fanPct: 70 });
  });

  it('takes charge, development, cap and batch from the run', () => {
    expect(make(ROAST)).toMatchObject({
      chargeC: 180,
      dryEndC: 150,
      devTimeS: 100,
      capC: 204,
      batchG: 375,
      needsCalibration: false,
      source: { kind: 'roast', roastId: 7 },
      name: 'Roast 7 · Steps',
    });
  });

  it('a profile from a roast made here needs no calibration; from an imported one it does', () => {
    expect(make(ROAST)?.needsCalibration).toBe(false);
    expect(make({ ...ROAST, imported: true })?.needsCalibration).toBe(true);
  });

  it('falls back on the roaster batch when the roast has none', () => {
    expect(make({ ...ROAST, batchG: null })?.batchG).toBe(385);
  });

  it('merges many small changes down to at most six running steps', () => {
    const samples = ROAST.samples.map((s) => ({
      tS: s.tS,
      values: { ...s.values, heater: s.tS < 60 ? 0 : 40 + (Math.floor(s.tS / 30) % 5) * 10 },
    }));
    const profile = make({ ...ROAST, samples });
    expect(profile?.phases.length).toBeLessThanOrEqual(7);
    expect(profile?.phases.slice(1, -1).length).toBeLessThanOrEqual(5);
  });

  it('makes a curve profile that follows the run, with steps only at fan changes', () => {
    const profile = make(ROAST, 'curve');
    expect(profile?.name).toBe('Roast 7 · Curve');
    expect(profile?.curve.length).toBeLessThanOrEqual(10);
    expect(profile?.curve.at(0)).toEqual({ tS: 0, c: 180 });
    expect(profile?.phases.slice(1).every((p) => p.heat.mode === 'follow')).toBe(true);
    expect(profile?.phases.map((p) => p.fanPct)).toEqual([30, 30, 50, 70, 70]);
  });

  it('has too little to go on without a drop, a first crack, readings or the dry end', () => {
    expect(make({ ...ROAST, dropTimeS: null })).toBeUndefined();
    expect(make({ ...ROAST, fcTimeS: null })).toBeUndefined();
    expect(make({ ...ROAST, samples: ROAST.samples.slice(0, 10) })).toBeUndefined();
    const cold = ROAST.samples.map((s) => ({ tS: s.tS, values: { ...s.values, bt: 120 } }));
    expect(make({ ...ROAST, samples: cold })).toBeUndefined();
  });
});

describe('profileFromRoast, around charge', () => {
  const withBt = (bt: (tS: number) => number, heater = 60) => ({
    ...ROAST,
    events: [],
    samples: ROAST.samples.map((s) => ({
      tS: s.tS,
      values: { bt: bt(s.tS), heater, fan: 30 },
    })),
  });
  const dip = (tS: number) => (tS < 60 ? 170 - tS : 110 + (tS - 60) * 0.15);

  it('takes the cap from the roast, not the hot charge', () => {
    expect(make(withBt((tS) => (tS < 60 ? 205 - tS : 145 + (tS - 60) * 0.11)))?.capC).toBe(208);
    expect(make(withBt(dip))?.capC).toBe(194);
  });

  it('refuses a roast that charged hotter than it dropped', () => {
    expect(make(withBt((tS) => (tS < 60 ? 230 - tS * 2 : 110 + (tS - 60) * 0.15)))).toBeUndefined();
  });

  it('does not pass the dry end on the charge reading alone', () => {
    const cold = withBt((tS) => (tS < 60 ? 180 - tS : 120 + (tS - 60) * 0.02));
    expect(make(cold)).toBeUndefined();
  });

  it('with the heater on through the dip, the first step only climbs', () => {
    const step = make(withBt(dip))?.phases[1];
    if (step?.heat.mode !== 'target') throw new Error('expected a target step');
    expect(step.heat.rorMin).toBeGreaterThan(0);
  });
});

describe('simplifyCurve', () => {
  it('keeps both ends and the sharpest corner', () => {
    const points = [0, 1, 2, 3, 4].map((tS) => ({ tS, c: tS === 2 ? 10 : 0 }));
    expect(simplifyCurve(points, 3)).toEqual([points[0], points[2], points[4]]);
  });

  it('leaves a short curve alone', () => {
    const points = [
      { tS: 0, c: 1 },
      { tS: 1, c: 2 },
    ];
    expect(simplifyCurve(points, 10)).toEqual(points);
  });

  it('stops when the rest already lie on the line', () => {
    const points = [0, 1, 2, 3].map((tS) => ({ tS, c: tS }));
    expect(simplifyCurve(points, 3)).toEqual([points[0], points[3]]);
  });
});
