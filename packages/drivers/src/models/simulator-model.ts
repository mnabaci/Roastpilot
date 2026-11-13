import type { RoasterModelDefinition } from '@roastpilot/core';
import { ROASTER_MODEL_FACTS } from '@roastpilot/shared';
import { SIMULATOR_CHANNELS, SimulatedDriver } from '../simulated/simulated-driver';
import { skywalkerModel } from './skywalker-model';

/** A fake roaster for practice and tests; it practises the Skywalker's profiles and batches. */
export const simulatorModel = {
  id: 'simulator',
  ...ROASTER_MODEL_FACTS.simulator,
  channels: SIMULATOR_CHANNELS,
  profiles: skywalkerModel.profiles,
  tuning: skywalkerModel.tuning,
  batch: skywalkerModel.batch,
  coolerHelpsDrum: false,
  createDriver: (_target, { clock }) => new SimulatedDriver({ clock }),
} as const satisfies RoasterModelDefinition;
