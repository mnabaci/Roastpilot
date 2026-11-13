import { ManualClock, silentLogger } from '@roastpilot/core';
import { SimulatedDriver, skywalkerModel } from '@roastpilot/drivers';
import { READY_ROAST, type RoastPhase } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { SimulatorBeans } from './simulator-beans';

const at = (phase: RoastPhase) => ({ ...READY_ROAST, phase });

function simulator() {
  const sim = new SimulatedDriver({ clock: new ManualClock() });
  const charge = vi.spyOn(sim, 'chargeBeans');
  const dump = vi.spyOn(sim, 'dumpBeans');
  const beans = new SimulatorBeans();
  beans.attach(sim);
  return { beans, charge, dump };
}

describe('SimulatorBeans', () => {
  it('puts beans in at Start and takes them out at Drop, once each', () => {
    const { beans, charge, dump } = simulator();
    for (const phase of ['preheat', 'roasting', 'development', 'cooling', 'done'] as const)
      beans.onRoast(at(phase));
    expect(charge).toHaveBeenCalledTimes(1);
    expect(dump).toHaveBeenCalledTimes(1);
    expect(charge.mock.invocationCallOrder[0]).toBeLessThan(dump.mock.invocationCallOrder[0] ?? 0);
  });

  it('takes them out when the roast ends early', () => {
    const { beans, dump } = simulator();
    beans.onRoast(at('roasting'));
    beans.onRoast(at('done'));
    expect(dump).toHaveBeenCalledTimes(1);
  });

  it('does nothing before a roast starts', () => {
    const { beans, charge, dump } = simulator();
    beans.onRoast(at('ready'));
    beans.onRoast(at('preheat'));
    expect(charge).not.toHaveBeenCalled();
    expect(dump).not.toHaveBeenCalled();
  });

  it('passes a real driver through and leaves it alone', () => {
    const beans = new SimulatorBeans();
    const driver = skywalkerModel.createDriver(
      { kind: 'serial', path: 'COM3' },
      { clock: new ManualClock(), logger: silentLogger },
    );
    expect(beans.attach(driver)).toBe(driver);
    expect(() => {
      beans.onRoast(at('roasting'));
    }).not.toThrow();
  });

  it('a new simulator starts empty, even mid-roast', () => {
    const { beans } = simulator();
    beans.onRoast(at('roasting'));
    const next = new SimulatedDriver({ clock: new ManualClock() });
    const charge = vi.spyOn(next, 'chargeBeans');
    beans.attach(next);
    beans.onRoast(at('roasting'));
    expect(charge).toHaveBeenCalledTimes(1);
  });
});
