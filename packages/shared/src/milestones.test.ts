import { describe, expect, it } from 'vitest';
import { MilestonesSchema, type Milestones } from './milestones';

/** Light · Curve's milestones (docs/spec/roast-control.md, Milestone builder). */
const LIGHT: Milestones = {
  chargeC: 180,
  turningPoint: { tS: 64, c: 92 },
  dryEnd: { tS: 305, c: 150 },
  firstCrack: { tS: 558, c: 190 },
  drop: { tS: 663, c: 197 },
  extras: [],
};

/** Each problem as `path: message`, so a test names the cell it lands on. */
function problems(milestones: Milestones): string[] {
  const parsed = MilestonesSchema.safeParse(milestones);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

describe('MilestonesSchema', () => {
  it('takes Light · Curve as it is', () => {
    expect(problems(LIGHT)).toEqual([]);
  });

  it('keeps charge inside the profile limits', () => {
    expect(problems({ ...LIGHT, chargeC: 240 })).toEqual(['chargeC: Between 100 and 230 °C']);
  });

  it('puts the turning point after charge and cooler than it', () => {
    expect(problems({ ...LIGHT, turningPoint: { tS: 0, c: 92 } })).toEqual([
      'turningPoint.tS: After 0:00',
    ]);
    expect(problems({ ...LIGHT, turningPoint: { tS: 64, c: 185 } })).toContain(
      'turningPoint.c: Below charge, 180 °C',
    );
  });

  it('keeps the milestones going forward in time', () => {
    expect(problems({ ...LIGHT, dryEnd: { tS: 60, c: 150 } })).toContain(
      'dryEnd.tS: After the turning point (1:04)',
    );
    expect(problems({ ...LIGHT, drop: { tS: 558, c: 197 } })).toContain(
      'drop.tS: After first crack (9:18)',
    );
  });

  it('warms up after the turning point', () => {
    expect(problems({ ...LIGHT, firstCrack: { tS: 558, c: 140 } })).toEqual([
      'firstCrack.c: Above 150 °C at 5:05',
    ]);
  });

  it('keeps development time, the cap and the drop time inside the limits', () => {
    expect(problems({ ...LIGHT, drop: { tS: 578, c: 197 } })).toEqual([
      'drop.tS: Between 0:30 and 10:00 after first crack',
    ]);
    expect(problems({ ...LIGHT, drop: { tS: 663, c: 233 } })).toEqual(['drop.c: At most 232 °C']);
    // The cap, 3 °C above drop, has to clear charge or the roast would drop as it starts.
    expect(problems({ ...LIGHT, chargeC: 200 })).toEqual(['drop.c: Above 197 °C']);
    const late = { ...LIGHT, firstCrack: { tS: 1000, c: 190 }, drop: { tS: 1090, c: 197 } };
    expect(problems(late)).toEqual(['drop.tS: At most 18:00']);
  });

  it('takes your points anywhere between the turning point and drop, warming in time order', () => {
    const extras = [
      { tS: 154, c: 110 },
      { tS: 477, c: 180 },
    ];
    expect(problems({ ...LIGHT, extras })).toEqual([]);
  });

  it('places your points between the turning point and drop, each at its own time', () => {
    expect(problems({ ...LIGHT, extras: [{ tS: 30, c: 120 }] })).toEqual([
      'extras.0.tS: Between 1:04 and 11:03',
    ]);
    expect(problems({ ...LIGHT, extras: [{ tS: 305, c: 160 }] })).toEqual([
      'extras.0.tS: Another point is at 5:05',
    ]);
  });

  it('names the later point when your points break the warming', () => {
    expect(problems({ ...LIGHT, extras: [{ tS: 400, c: 140 }] })).toEqual([
      'extras.0.c: Above 150 °C at 5:05',
    ]);
    expect(problems({ ...LIGHT, extras: [{ tS: 200, c: 160 }] })).toEqual([
      'dryEnd.c: Above 160 °C at 3:20',
    ]);
  });
});
