import type { Channel } from '@roastpilot/shared';
import { SKYWALKER_CHANNELS } from '../skywalker';

/**
 * The Skywalker's channels, but with a drum speed (0–100 %) instead of on/off, so drum speed can be
 * tried without such a roaster, and an ET, so the ET card and line can be seen without a TC4 roaster
 * (docs/spec/hardware.md). The thermal model ignores the drum.
 */
export const SIMULATOR_CHANNELS: readonly Channel[] = SKYWALKER_CHANNELS.flatMap(
  (channel): Channel[] => {
    if (channel.id === 'drum')
      return [{ id: 'drum', kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 }];
    if (channel.id === 'bt')
      return [
        channel,
        {
          id: 'et',
          kind: 'sensor',
          unit: 'celsius',
          name: 'Environment temperature',
          short: 'ET',
        },
      ];
    return [channel];
  },
);
