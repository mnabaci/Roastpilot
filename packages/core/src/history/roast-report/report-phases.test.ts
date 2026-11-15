import { describe, expect, it } from 'vitest';
import { keyMoments, reportPhases } from './report-phases';
import { savedEvent, savedRoast, samplesFromRor, steadyRor } from './roast-report.harness';
import { btPoints } from './ror-series';

const samples = samplesFromRor(steadyRor, 700);
const points = btPoints(samples);

describe('keyMoments', () => {
  it('takes a marked dry end as it was marked', () => {
    const detail = savedRoast({ samples, events: [savedEvent('dry-end', 250)] });
    expect(keyMoments(detail, points, 660).dryEnd).toMatchObject({ tS: 250, estimated: false });
  });

  it('estimates dry end where BT first reaches 150 °C (or the profile’s) with no mark', () => {
    const { dryEnd } = keyMoments(savedRoast({ samples }), points, 660);
    expect(dryEnd?.estimated).toBe(true);
    expect(dryEnd?.c).toBeGreaterThanOrEqual(150);
    expect(dryEnd?.tS).toBeGreaterThan(250);
    expect(dryEnd?.tS).toBeLessThan(290);
  });

  it('leaves out a first crack at or after drop, and a dry end after first crack', () => {
    const late = savedRoast({ samples, fcS: 680, events: [savedEvent('dry-end', 600)] });
    const moments = keyMoments(late, points, 660);
    expect(moments.firstCrack).toBeUndefined();
    // With no first crack, a dry end before drop still counts.
    expect(moments.dryEnd).toMatchObject({ tS: 600, estimated: false });

    const odd = savedRoast({ samples, events: [savedEvent('dry-end', 600)] });
    expect(keyMoments(odd, points, 660).dryEnd?.estimated).toBe(true);
  });

  it('finds the turning point as the lowest early BT when none was marked', () => {
    const detail = savedRoast({ samples });
    detail.events = detail.events.filter((e) => e.kind !== 'turning-point');
    expect(keyMoments(detail, points, 660).turningPoint).toEqual({ tS: 60, c: 90 });
  });

  it('has no dry end when BT never got there', () => {
    const cool = btPoints(samplesFromRor(() => 5, 400));
    const { dryEnd } = keyMoments(savedRoast({ samples, fcS: null }), cool, 400);
    expect(dryEnd).toBeUndefined();
  });
});

describe('reportPhases', () => {
  const dryEnd = { tS: 264, c: 150, estimated: false };
  const firstCrack = { tS: 540, c: 200 };

  it('splits charge to drop into drying, Maillard and development', () => {
    const phases = reportPhases({ dryEnd, firstCrack }, 660);
    expect(phases.map((p) => [p.kind, p.fromS, p.toS])).toEqual([
      ['drying', 0, 264],
      ['maillard', 264, 540],
      ['development', 540, 660],
    ]);
    expect(phases.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1, 10);
    expect(phases[2]?.share).toBeCloseTo(120 / 660, 10);
  });

  it('runs Maillard to the end when there was no first crack', () => {
    expect(reportPhases({ dryEnd, firstCrack: undefined }, 600).map((p) => p.kind)).toEqual([
      'drying',
      'maillard',
    ]);
  });

  it('has one stretch before first crack when dry end can’t be placed', () => {
    expect(reportPhases({ dryEnd: undefined, firstCrack }, 660).map((p) => p.kind)).toEqual([
      'before-crack',
      'development',
    ]);
  });

  it('is empty with neither', () => {
    expect(reportPhases({ dryEnd: undefined, firstCrack: undefined }, 600)).toEqual([]);
  });
});
