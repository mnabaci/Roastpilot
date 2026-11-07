import { RoasterSchema } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROASTERS, newRoaster, ROASTER_MODELS } from './roaster-models';

const drum = (model: keyof typeof ROASTER_MODELS) =>
  ROASTER_MODELS[model].channels.find((c) => c.id === 'drum');

describe('newRoaster', () => {
  it('a Skywalker has the bean cooler helping cool the drum; a Simulator does not', () => {
    expect(newRoaster('A', 'skywalker').coolerHelpsDrum).toBe(true);
    expect(newRoaster('B', 'simulator').coolerHelpsDrum).toBe(false);
  });

  it('the built-in records match what migration 0005 sets', () => {
    expect(BUILT_IN_ROASTERS.map((r) => [r.model, r.coolerHelpsDrum])).toEqual([
      ['skywalker', true],
      ['simulator', false],
    ]);
  });

  it('starts every roaster at the usual drum speed of 60 %', () => {
    expect(newRoaster('A', 'simulator').drumSpeedPct).toBe(60);
    expect(BUILT_IN_ROASTERS.every((r) => r.drumSpeedPct === 60)).toBe(true);
  });
});

describe('ROASTER_MODELS', () => {
  it("knows each model's drum without connecting: on/off on a Skywalker, a speed on the Simulator", () => {
    expect(drum('skywalker')).toMatchObject({ unit: 'on-off', max: 1 });
    expect(drum('simulator')).toMatchObject({ unit: 'percent', min: 0, max: 100, step: 5 });
  });
});

describe('drum speed on the record', () => {
  const record = BUILT_IN_ROASTERS[1];
  const problem = (drumSpeedPct: number) =>
    RoasterSchema.safeParse({ ...record, drumSpeedPct }).error?.issues[0]?.message;

  it('takes 5–100 % in steps of 5', () => {
    expect(problem(5)).toBeUndefined();
    expect(problem(100)).toBeUndefined();
    expect(problem(0)).toBe('At least 5 %');
    expect(problem(105)).toBe('At most 100 %');
    expect(problem(62)).toBe('In steps of 5 %');
  });
});
