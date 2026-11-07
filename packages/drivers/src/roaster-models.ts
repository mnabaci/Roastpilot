import {
  DRUM_SPEED,
  MODEL_LIMITS,
  type AutoProfile,
  type Channel,
  type AutoTuning,
  type Roaster,
  type RoasterModel,
} from '@roastpilot/shared';
import { SIMULATOR_CHANNELS } from './simulated/simulated-driver';
import { SKYWALKER_CHANNELS } from './skywalker';
import { SKYWALKER_PROFILES, SKYWALKER_TUNING } from './skywalker-profiles';

const LIGHT = Object.values(SKYWALKER_PROFILES);

/** What each model ships with (docs/spec/roasters.md). The Simulator practises the Skywalker's. */
export const ROASTER_MODELS: Readonly<
  Record<
    RoasterModel,
    {
      label: string;
      /** What its driver reads and controls, known without connecting. */
      channels: readonly Channel[];
      profiles: readonly AutoProfile[];
      tuning: AutoTuning;
      batch: { minG: number; idealG: number; maxG: number };
    }
  >
> = {
  skywalker: {
    label: 'Skywalker',
    channels: SKYWALKER_CHANNELS,
    profiles: LIGHT,
    tuning: SKYWALKER_TUNING,
    batch: { minG: 250, idealG: 375, maxG: 400 },
  },
  simulator: {
    label: 'Simulator',
    channels: SIMULATOR_CHANNELS,
    profiles: LIGHT,
    tuning: SKYWALKER_TUNING,
    batch: { minG: 250, idealG: 375, maxG: 400 },
  },
};

/** A new record of a model, with its starting values. */
export function newRoaster(name: string, model: RoasterModel): Omit<Roaster, 'id'> {
  const { batch, tuning } = ROASTER_MODELS[model];
  const { maxTempC, maxTimeS } = MODEL_LIMITS[model];
  return {
    name,
    model,
    connection: model === 'simulator' ? { kind: 'simulator' } : null,
    batchMinG: batch.minG,
    batchIdealG: batch.idealG,
    batchMaxG: batch.maxG,
    maxTempC,
    maxTimeS,
    tempOffsetC: 0,
    tuning,
    // The Skywalker's tray fan sits under the drum.
    coolerHelpsDrum: model === 'skywalker',
    drumSpeedPct: DRUM_SPEED.defaultPct,
    active: false,
  };
}

/** The two records the migration makes: what the app runs on when the database can't be read. */
export const BUILT_IN_ROASTERS: readonly Roaster[] = [
  { ...newRoaster('Skywalker', 'skywalker'), id: 1, active: true },
  { ...newRoaster('Simulator', 'simulator'), id: 2 },
];
