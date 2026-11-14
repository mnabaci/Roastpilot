import { soakLengthS, type RoasterModelDefinition } from '@roastpilot/core';
import { DEFAULT_TC4_WIRING, ROASTER_MODEL_FACTS, type AutoProfile } from '@roastpilot/shared';
import { SerialTransport } from '../serial-transport';
import { stockTc4Dialect } from '../tc4/stock-tc4-dialect';
import { Tc4Driver } from '../tc4/tc4-driver';
import { skywalkerModel } from './skywalker-model';

/** A starting range for a home-built roaster; the record is where it is made its own. */
const TC4_BATCH = { minG: 100, idealG: 150, maxG: 250 } as const;

/**
 * A Skywalker profile as a TC4 template: sized to its ideal batch, so a batch plan never starts
 * outside its range, and without the heat-off soak. That soak is the Skywalker's (its hot drum
 * scorches beans); a popper or heat gun would only stall in it (docs/spec/roast-control.md).
 */
function tc4Template(profile: AutoProfile): AutoProfile {
  const phases = soakLengthS(profile) > 0 ? profile.phases.slice(1) : profile.phases;
  return { ...profile, batchG: TC4_BATCH.idealG, phases };
}

/**
 * A home-built roaster on an Arduino + TC4 board with the stock firmware (docs/spec/roasters.md,
 * Generic TC4): one model for every build, its wiring on the record. It starts from the
 * Skywalker's profiles and gains as templates, marked "needs calibration".
 */
export const tc4Model = {
  id: 'tc4',
  ...ROASTER_MODEL_FACTS.tc4,
  // Declared without connecting: the firmware's default wiring, with an ET probe.
  channels: stockTc4Dialect(DEFAULT_TC4_WIRING).channels,
  profiles: skywalkerModel.profiles.map(tc4Template),
  tuning: skywalkerModel.tuning,
  batch: TC4_BATCH,
  coolerHelpsDrum: false,
  createDriver: (target, { clock, logger }, { wiring }) => {
    if (target.kind !== 'serial')
      throw new Error(`A generic TC4 needs a serial port, not ${target.kind}`);
    if (!wiring) throw new Error('A generic TC4 record always has its wiring');
    const transport = new SerialTransport({
      path: target.path,
      baudRate: wiring.baud,
      logger: logger.child('serial'),
    });
    return new Tc4Driver({
      dialect: stockTc4Dialect(wiring),
      transport,
      clock,
      logger: logger.child('tc4'),
    });
  },
} as const satisfies RoasterModelDefinition;
