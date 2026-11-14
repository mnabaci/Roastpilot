import type { RoasterModelDefinition } from '@roastpilot/core';
import { ROASTER_MODEL_FACTS } from '@roastpilot/shared';
import { SerialTransport } from '../serial-transport';
import { SKYWALKER_CHANNELS } from '../skywalker';
import { SKYWALKER_PROFILES, SKYWALKER_TUNING } from '../skywalker-profiles';
import { skyCommandDialect } from '../tc4/sky-command-dialect';
import { Tc4Driver } from '../tc4/tc4-driver';

/** The Skywalker with the SkyCommand ESP32 mod: the TC4 driver in its SkyCommand dialect, over USB serial (docs/spec/roasters.md). */
export const skywalkerModel = {
  id: 'skywalker',
  ...ROASTER_MODEL_FACTS.skywalker,
  channels: SKYWALKER_CHANNELS,
  profiles: Object.values(SKYWALKER_PROFILES),
  tuning: SKYWALKER_TUNING,
  batch: { minG: 250, idealG: 375, maxG: 400 },
  // Its tray fan sits under the drum.
  coolerHelpsDrum: true,
  createDriver: (target, { clock, logger }) => {
    if (target.kind !== 'serial')
      throw new Error(`Skywalker needs a serial port, not ${target.kind}`);
    const transport = new SerialTransport({ path: target.path, logger: logger.child('serial') });
    return new Tc4Driver({
      dialect: skyCommandDialect,
      transport,
      clock,
      logger: logger.child('tc4'),
    });
  },
} as const satisfies RoasterModelDefinition;
