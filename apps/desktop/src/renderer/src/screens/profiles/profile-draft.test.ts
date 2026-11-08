import { describe, expect, it } from 'vitest';
import { CURVE, STEPS } from '../../test/profiles';
import { addPoint, addStep, removePoint, removeStep } from './draft-edits';
import { fromDraft, toDraft, type ProfileDraft } from './profile-draft';

const steps = () => toDraft(STEPS);
const withStep = (draft: ProfileDraft, index: number, change: object): ProfileDraft => ({
  ...draft,
  steps: draft.steps.map((step, i) => (i === index ? { ...step, ...change } : step)),
});
const errorsOf = (draft: ProfileDraft, base = STEPS) => {
  const result = fromDraft(draft, base);
  return result.ok ? {} : result.error;
};

describe('toDraft and fromDraft', () => {
  it('gives a step profile back unchanged', () => {
    expect(fromDraft(steps(), STEPS)).toEqual({ ok: true, value: STEPS });
  });

  it('gives a curve profile back unchanged', () => {
    expect(fromDraft(toDraft(CURVE), CURVE)).toEqual({ ok: true, value: CURVE });
  });

  it('shows times as m:ss', () => {
    expect(steps().devTime).toBe('1:30');
    expect(steps().steps[0]).toMatchObject({ time: '4:05', backup: '6:30', endC: '150' });
  });

  it('one end temperature sets both the target and the trigger', () => {
    const result = fromDraft(withStep(steps(), 0, { endC: '155' }), STEPS);
    if (!result.ok) throw new Error('expected a profile');
    const [, step] = result.value.phases;
    expect(step?.heat).toMatchObject({ endC: 155 });
    expect(step?.next).toMatchObject({ c: 155 });
  });

  it('charge temp is also where the curve starts', () => {
    const result = fromDraft({ ...steps(), chargeC: '170' }, STEPS);
    if (!result.ok) throw new Error('expected a profile');
    expect(result.value.curve[0]).toEqual({ tS: 0, c: 170 });
  });
});

describe('the soak', () => {
  const NO_SOAK = { ...STEPS, phases: STEPS.phases.slice(1) };

  it('holds its length, or null for none', () => {
    expect(steps().soakS).toBe(60);
    expect(toDraft(NO_SOAK)).toMatchObject({ soakS: null, soakFan: '30' });
    expect(toDraft(NO_SOAK).steps.map((s) => s.name)).toEqual(['Heat on', 'Development']);
  });

  it('sets the soak to the length chosen', () => {
    const result = fromDraft({ ...steps(), soakS: 90 }, STEPS);
    if (!result.ok) throw new Error('expected a profile');
    expect(result.value.phases[0]?.next).toEqual({ on: 'time', afterS: 90 });
  });

  it('Off leaves the soak out, whatever its fan says', () => {
    const result = fromDraft({ ...steps(), soakS: null, soakFan: 'x' }, STEPS);
    expect(result).toEqual({ ok: true, value: NO_SOAK });
  });

  it('gives a profile without a soak back unchanged', () => {
    expect(fromDraft(toDraft(NO_SOAK), NO_SOAK)).toEqual({ ok: true, value: NO_SOAK });
  });

  it('comes back as a fixed 0 % soak with the fan you had', () => {
    const result = fromDraft({ ...toDraft(NO_SOAK), soakS: 45, soakFan: '35' }, NO_SOAK);
    if (!result.ok) throw new Error('expected a profile');
    expect(result.value.phases[0]).toEqual({
      name: 'Soak',
      heat: { mode: 'fixed', pct: 0 },
      fanPct: 35,
      next: { on: 'time', afterS: 45 },
    });
  });

  it("needs the first step's backup after the soak", () => {
    expect(errorsOf({ ...steps(), soakS: 120 }, STEPS)).toEqual({});
    expect(errorsOf(withStep({ ...steps(), soakS: 120 }, 0, { backup: '2:00' }))).toEqual({
      'steps.0.backup': 'Must be after the soak',
    });
  });

  it('points a step problem at its cell without a soak', () => {
    const draft = withStep(toDraft(NO_SOAK), 0, { heat: '120' });
    expect(errorsOf(draft, NO_SOAK)).toHaveProperty('steps.0.heat');
  });
});

describe('what the draft refuses', () => {
  it('names the cell with a half-typed number or time', () => {
    expect(errorsOf({ ...steps(), capC: '2x' })).toMatchObject({ capC: 'Enter a number' });
    expect(errorsOf({ ...steps(), devTime: '90' })).toMatchObject({
      devTime: 'Enter a time like 1:30',
    });
    expect(errorsOf(withStep(steps(), 0, { time: '' }))).toMatchObject({
      'steps.0.time': 'Enter a time like 1:30',
    });
  });

  it('needs names', () => {
    expect(errorsOf({ ...steps(), name: ' ' })).toMatchObject({ name: 'Enter a name' });
    expect(errorsOf(withStep(steps(), 0, { name: '' }))).toMatchObject({
      'steps.0.name': 'Enter a name',
    });
  });

  it('points a limit from the format at its cell', () => {
    expect(errorsOf({ ...steps(), capC: '300' })).toHaveProperty('capC');
    expect(errorsOf({ ...steps(), devTime: '0:10' })).toHaveProperty('devTime');
    expect(errorsOf(withStep(steps(), 0, { heat: '120' }))).toHaveProperty('steps.0.heat');
    expect(errorsOf(withStep(steps(), 0, { fan: '120' }))).toHaveProperty('steps.0.fan');
    expect(errorsOf({ ...steps(), soakFan: '120' })).toHaveProperty('soakFan');
    expect(errorsOf(withStep(steps(), 0, { endC: '210' }))).toHaveProperty('steps.0.endC');
  });

  it('refuses an upside-down RoR range', () => {
    const errors = errorsOf(withStep(steps(), 0, { rorMin: '20', rorMax: '10' }));
    expect(Object.keys(errors).some((key) => key.startsWith('steps.0'))).toBe(true);
  });

  it('refuses a curve that goes back in time, at that point', () => {
    const base = toDraft(CURVE);
    const points = base.points.map((p, i) => (i === 1 ? { ...p, time: '0:01' } : p));
    expect(errorsOf({ ...base, points }, CURVE)).not.toEqual({});
  });
});

describe('adding and removing', () => {
  it('adds a step before the last, halfway up', () => {
    const added = addStep(steps());
    expect(added.steps.map((s) => s.name)).toEqual(['Heat on', 'New step', 'Development']);
    expect(added.steps[1]?.endC).toBe('171');
  });

  it('removes a step but never the last', () => {
    expect(removeStep(steps(), 0).steps.map((s) => s.name)).toEqual(['Development']);
    expect(removeStep(steps(), 1).steps).toHaveLength(2);
  });

  it('adds and removes curve points', () => {
    const base = toDraft(CURVE);
    expect(addPoint(base).points).toHaveLength(base.points.length + 1);
    expect(removePoint(base, 0).points).toHaveLength(base.points.length - 1);
  });
});
