import type { Channel } from '@roastpilot/shared';

/** Facts about the Skywalker + SkyCommand setup (docs/spec/hardware.md), shared by the real driver and its twin. */
export const SKYWALKER_PROTOCOL_VERSION = 1;

const percent = { kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 } as const;

export const SKYWALKER_CHANNELS: readonly Channel[] = [
  { id: 'bt', kind: 'sensor', unit: 'celsius' },
  { id: 'heater', ...percent },
  { id: 'fan', ...percent },
  { id: 'cooling', ...percent },
  { id: 'filter', ...percent },
  { id: 'drum', kind: 'output', unit: 'on-off', min: 0, max: 1, step: 1 },
];

/** Sent in this order on every safety trip. */
export const SKYWALKER_SAFE_STOP: readonly (readonly [channel: string, value: number])[] = [
  ['heater', 0],
  ['fan', 100],
  ['cooling', 100],
];

/** The sketch switches everything off after this long without a command (READ included). */
export const SKYWALKER_WATCHDOG_MS = 10_000;

/** The sketch runs ESTOP (heater 0, fan 100) above this temperature. */
export const SKYWALKER_ESTOP_C = 300;
