import type { RoasterModelDefinition } from '@roastpilot/core';
import { DEFAULT_TC4_WIRING, ROASTER_MODEL_FACTS } from '@roastpilot/shared';
import { SerialTransport } from '../serial-transport';
import { stockTc4Dialect } from '../tc4/stock-tc4-dialect';
import { Tc4Driver } from '../tc4/tc4-driver';
import { skywalkerModel } from './skywalker-model';

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
  profiles: skywalkerModel.profiles,
  tuning: skywalkerModel.tuning,
  batch: { minG: 100, idealG: 150, maxG: 250 },
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
