import { describe, expect, it } from 'vitest';
import { Pid } from './pid';

const WIDE = { min: -100, max: 100 };

describe('Pid', () => {
  it('is proportional to the error', () => {
    expect(new Pid({ kp: 2, ki: 0, kd: 0 }).update(5, 1, WIDE)).toBe(10);
  });

  it('adds up the error over time', () => {
    const pid = new Pid({ kp: 0, ki: 0.5, kd: 0 });
    pid.update(2, 1, WIDE);
    expect(pid.update(2, 1, WIDE)).toBe(2);
  });

  it('reacts to how fast the error changes, but not on the first call', () => {
    const pid = new Pid({ kp: 0, ki: 0, kd: 3 });
    expect(pid.update(4, 1, WIDE)).toBe(0);
    expect(pid.update(6, 2, WIDE)).toBe(3);
  });

  it('stays inside its limits', () => {
    const limits = { min: -10, max: 10 };
    const pid = new Pid({ kp: 100, ki: 0, kd: 0 });
    expect(pid.update(5, 1, limits)).toBe(10);
    expect(pid.update(-5, 1, limits)).toBe(-10);
  });

  it('stops the integral at a limit, so it comes off the limit as soon as the error turns', () => {
    const limits = { min: -10, max: 10 };
    const pid = new Pid({ kp: 0, ki: 1, kd: 0 });
    for (let i = 0; i < 100; i++) pid.update(5, 1, limits);
    expect(pid.update(-5, 1, limits)).toBeLessThan(10);
  });

  it('lets go of heat built up under wider limits as soon as they narrow', () => {
    const pid = new Pid({ kp: 1, ki: 0.5, kd: 0 });
    const wide = { min: -20, max: 30 };
    for (let i = 0; i < 100; i++) pid.update(1, 1, wide);
    const narrow = { min: -20, max: 20 };
    pid.update(1, 1, narrow);
    expect(pid.update(-2, 1, narrow)).toBe(17);
  });

  it('uses new limits straight away', () => {
    const pid = new Pid({ kp: 100, ki: 0, kd: 0 });
    pid.update(5, 1, { min: -10, max: 10 });
    expect(pid.update(5, 1, { min: -10, max: 20 })).toBe(20);
  });

  it.each([
    ['NaN error', Number.NaN, 1],
    ['infinite error', Number.POSITIVE_INFINITY, 1],
    ['no time passed', 5, 0],
    ['time going backwards', 5, -1],
  ])('repeats the last output on %s', (_name, error, dtS) => {
    const pid = new Pid({ kp: 1, ki: 0, kd: 0 });
    pid.update(3, 1, WIDE);
    expect(pid.update(error, dtS, WIDE)).toBe(3);
  });

  it('starts from 0 when the first call has a bad error', () => {
    expect(new Pid({ kp: 1, ki: 1, kd: 1 }).update(Number.NaN, 1, WIDE)).toBe(0);
  });
});
