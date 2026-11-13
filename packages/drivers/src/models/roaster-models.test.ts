import { ManualClock, silentLogger, type RoasterModelDefinition } from '@roastpilot/core';
import { ROASTER_MODEL_FACTS, RoasterSchema } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROASTERS } from '../built-in-roasters';
import { SimulatedDriver } from '../simulated/simulated-driver';
import { Tc4SkywalkerDriver } from '../tc4/tc4-skywalker-driver';
import { simulatorModel } from './simulator-model';
import { skywalkerModel } from './skywalker-model';

const MODELS: readonly RoasterModelDefinition[] = [skywalkerModel, simulatorModel];
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

  it('agree with what the screens know about each drum', () => {
    for (const model of MODELS) {
      const channel = drum(model);
      expect(channel?.kind === 'output' && channel.unit === 'percent').toBe(model.drumSpeed);
    }
  });

  it('a Skywalker builds the TC4 driver for a serial port', () => {
    expect(skywalkerModel.createDriver({ kind: 'serial', path: 'COM3' }, deps)).toBeInstanceOf(
      Tc4SkywalkerDriver,
    );
  });

  it('a Skywalker given anything but a port is a programmer error', () => {
    expect(() => skywalkerModel.createDriver({ kind: 'simulator' }, deps)).toThrow(/serial/);
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
