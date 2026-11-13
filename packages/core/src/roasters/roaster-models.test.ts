import { ROASTER_MODEL_FACTS, type ConnectTarget, type RoasterModel } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../clock';
import type { LogContext, Logger } from '../logging/logger';
import { silentLogger } from '../logging/logger';
import type { RoasterDriver } from '../roaster-driver';
import type { RoasterModelDefinition } from './roaster-model-definition';
import { createDriver, newRoaster, roasterModels } from './roaster-models';

const stubDriver = (name: string): RoasterDriver =>
  ({ channels: [], name }) as unknown as RoasterDriver;

function definition<M extends RoasterModel>(
  id: M,
  built: ConnectTarget[],
): RoasterModelDefinition & { id: M } {
  return {
    id,
    ...ROASTER_MODEL_FACTS[id],
    channels: [],
    profiles: [],
    tuning: {} as RoasterModelDefinition['tuning'],
    batch: { minG: 100, idealG: 150, maxG: 200 },
    coolerHelpsDrum: id === 'skywalker',
    createDriver: (target) => {
      built.push(target);
      return stubDriver(id);
    },
  };
}

function setup() {
  const built: ConnectTarget[] = [];
  const warnings: [string, LogContext | undefined][] = [];
  const logger: Logger = {
    ...silentLogger,
    warn: (event, context) => {
      warnings.push([event, context]);
    },
  };
  const models = roasterModels({
    skywalker: definition('skywalker', built),
    simulator: definition('simulator', built),
  });
  return { models, built, warnings, deps: { clock: new ManualClock(), logger } };
}

describe('roasterModels', () => {
  it('lists every registered model and gets each by id', () => {
    const { models } = setup();
    expect(models.all.map((m) => m.id)).toEqual(['skywalker', 'simulator']);
    expect(models.get('simulator').label).toBe('Simulator');
  });

  it('finds a known id', () => {
    const found = setup().models.find('skywalker');
    expect(found.ok && found.value.id).toBe('skywalker');
  });

  it('returns a typed error for an unknown id instead of throwing', () => {
    expect(setup().models.find('behmor')).toEqual({
      ok: false,
      error: { kind: 'unknown-model', model: 'behmor' },
    });
  });
});

describe('createDriver', () => {
  it("builds the roaster's own model's driver for its kind of target", () => {
    const { models, built, deps } = setup();
    const made = createDriver(
      models,
      { model: 'skywalker' },
      { kind: 'serial', path: 'COM3' },
      deps,
    );
    expect(made.ok && (made.value as unknown as { name: string }).name).toBe('skywalker');
    expect(built).toEqual([{ kind: 'serial', path: 'COM3' }]);
  });

  it('refuses a target the model does not use, and logs it', () => {
    const { models, built, warnings, deps } = setup();
    const made = createDriver(
      models,
      { model: 'simulator' },
      { kind: 'serial', path: 'COM3' },
      deps,
    );
    expect(made).toEqual({
      ok: false,
      error: { kind: 'wrong-connection', model: 'simulator', expected: 'simulator' },
    });
    expect(built).toEqual([]);
    expect(warnings.map(([event]) => event)).toEqual(['driver.wrong-connection']);
  });
});

describe('newRoaster', () => {
  it("starts from the model's facts and starting values", () => {
    const { models } = setup();
    expect(newRoaster('Mine', models.get('skywalker'))).toMatchObject({
      name: 'Mine',
      model: 'skywalker',
      connection: null,
      batchMinG: 100,
      maxTempC: 240,
      maxTimeS: 1200,
      coolerHelpsDrum: true,
      drumSpeedPct: 60,
      active: false,
    });
  });

  it('a Simulator-kind model is connected to the simulator from the start', () => {
    expect(newRoaster('Sim', setup().models.get('simulator')).connection).toEqual({
      kind: 'simulator',
    });
  });
});
