import { describe, expect, it } from 'vitest';
import { coolingOutputs } from './cooling-outputs';

const run = (beans: boolean, drum: boolean, coolerHelpsDrum = false) =>
  Object.fromEntries(coolingOutputs({ beans, drum, coolerHelpsDrum }));

describe('coolingOutputs', () => {
  it('beans cooling: heater off, fan 100, bean cooler, drum and filter on', () => {
    expect(run(true, false)).toEqual({ heater: 0, fan: 100, cooling: 100, drum: 1, filter: 1 });
    expect(run(true, true)).toEqual({ heater: 0, fan: 100, cooling: 100, drum: 1, filter: 1 });
  });

  it('drum only: fan and drum; the bean cooler only when it helps cool the drum', () => {
    expect(run(false, true)).toEqual({ heater: 0, fan: 100, cooling: 0, drum: 1, filter: 0 });
    expect(run(false, true, true)).toEqual({
      heater: 0,
      fan: 100,
      cooling: 100,
      drum: 1,
      filter: 0,
    });
  });

  it('nothing running: everything off, in the ALL_OFF order', () => {
    expect(coolingOutputs({ beans: false, drum: false, coolerHelpsDrum: true })).toEqual([
      ['heater', 0],
      ['fan', 0],
      ['cooling', 0],
      ['drum', 0],
      ['filter', 0],
    ]);
  });
});
