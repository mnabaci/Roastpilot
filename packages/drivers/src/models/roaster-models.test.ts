import {
  ManualClock,
  silentLogger,
  soakLengthS,
  type RoasterModelDefinition,
} from '@roastpilot/core';
import {
  AutoProfileSchema,
  DEFAULT_TC4_WIRING,
  ROASTER_MODEL_FACTS,
  RoasterSchema,
} from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROASTERS } from '../built-in-roasters';
import { SimulatedDriver } from '../simulated/simulated-driver';
import { Tc4Driver } from '../tc4/tc4-driver';
import { simulatorModel } from './simulator-model';
import { skywalkerModel } from './skywalker-model';
import { tc4Model } from './tc4-model';

const MODELS: readonly RoasterModelDefinition[] = [skywalkerModel, tc4Model, simulatorModel];
const NO_WIRING = { wiring: null };
const deps = { clock: new ManualClock(), logger: silentLogger };
const drum = (model: RoasterModelDefinition) => model.channels.find((c) => c.id === 'drum');

describe('model definitions', () => {
  it('carry their entry in the model list unchanged', () => {
    for (const model of MODELS) {
      expect(model).toMatchObject(ROASTER_MODEL_FACTS[model.id]);
    }
  });

  it("know each model's drum without connecting: on/off on a Skywalker, a speed on the Simulator", () => {
    expect(drum(skywalkerModel)).toMatchObject({ unit: 'on-off', max: 1 });
    expect(drum(simulatorModel)).toMatchObject({ unit: 'percent', min: 0, max: 100, step: 5 });
  });

  it('have a bean cooler exactly when the record offers one', () => {
    for (const model of MODELS) {
      expect(model.channels.some((c) => c.id === 'cooling')).toBe(model.beanCooler);
    }
  });

  it('agree with what the screens know about each drum', () => {
    for (const model of MODELS) {
      const channel = drum(model);
      expect(channel?.kind === 'output' && channel.unit === 'percent').toBe(model.drumSpeed);
    }
  });

  it('a Skywalker builds the TC4 driver for a serial port', () => {
    expect(skywalkerModel.createDriver({ kind: 'serial', path: 'COM3' }, deps)).toBeInstanceOf(
      Tc4Driver,
    );
  });

  it('a Skywalker given anything but a port is a programmer error', () => {
    expect(() => skywalkerModel.createDriver({ kind: 'simulator' }, deps)).toThrow(/serial/);
  });

  it('a generic TC4 builds the TC4 driver from its wiring, and has no drum', () => {
    const driver = tc4Model.createDriver({ kind: 'serial', path: 'COM3' }, deps, {
      wiring: { ...DEFAULT_TC4_WIRING, etInput: 0 },
    });
    expect(driver).toBeInstanceOf(Tc4Driver);
    expect(driver.channels.map((c) => c.id)).toEqual(['bt', 'heater', 'fan']);
    expect(drum(tc4Model)).toBeUndefined();
  });

  it("starts every built-in profile inside the model's batch range", () => {
    for (const model of MODELS) {
      for (const profile of model.profiles) {
        expect(profile.batchG).toBeGreaterThanOrEqual(model.batch.minG);
        expect(profile.batchG).toBeLessThanOrEqual(model.batch.maxG);
      }
    }
  });

  it("gives a generic TC4 the Skywalker's profiles as templates, without its heat-off soak", () => {
    expect(tc4Model.profiles.map((p) => p.id)).toEqual(skywalkerModel.profiles.map((p) => p.id));
    for (const profile of tc4Model.profiles) {
      expect(profile.needsCalibration).toBe(true);
      expect(soakLengthS(profile)).toBe(0);
      expect(AutoProfileSchema.safeParse(profile).success).toBe(true);
    }
    expect(skywalkerModel.profiles.every((p) => soakLengthS(p) === 60)).toBe(true);
  });

  it('a generic TC4 without its wiring is a programmer error', () => {
    expect(() => tc4Model.createDriver({ kind: 'serial', path: 'COM3' }, deps, NO_WIRING)).toThrow(
      /wiring/,
    );
  });

  it('the Simulator builds the simulated driver', () => {
    expect(simulatorModel.createDriver({ kind: 'simulator' }, deps)).toBeInstanceOf(
      SimulatedDriver,
    );
  });
});

describe('BUILT_IN_ROASTERS', () => {
  it('a Skywalker has the bean cooler helping cool the drum; a Simulator does not', () => {
    expect(BUILT_IN_ROASTERS.map((r) => [r.model, r.coolerHelpsDrum])).toEqual([
      ['skywalker', true],
      ['simulator', false],
    ]);
  });

  it('match what migration 0005 sets, connection included', () => {
    expect(BUILT_IN_ROASTERS.map((r) => [r.id, r.name, r.active, r.connection])).toEqual([
      [1, 'Skywalker', true, null],
      [2, 'Simulator', false, { kind: 'simulator' }],
    ]);
  });

  it('start every roaster at the usual drum speed of 60 %', () => {
    expect(BUILT_IN_ROASTERS.every((r) => r.drumSpeedPct === 60)).toBe(true);
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
