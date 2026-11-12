import { newRoaster } from '@roastpilot/core';
import type { Roaster } from '@roastpilot/shared';
import { simulatorModel } from './models/simulator-model';
import { skywalkerModel } from './models/skywalker-model';

/** The two records the migration makes: what the app runs on when the database can't be read. */
export const BUILT_IN_ROASTERS: readonly Roaster[] = [
  { ...newRoaster('Skywalker', skywalkerModel), id: 1, active: true },
  { ...newRoaster('Simulator', simulatorModel), id: 2 },
];
