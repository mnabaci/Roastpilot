import { err, ok } from '@roastpilot/shared';
import { SKYWALKER_CHANNELS, SKYWALKER_PROTOCOL_VERSION, SKYWALKER_SAFE_STOP } from '../skywalker';
import {
  isReadReplyShape,
  isVersionReplyShape,
  parseReadReply,
  parseVersionReply,
} from './replies';
import type { Tc4Dialect } from './tc4-dialect';

/** The Skywalker mod's SkyCommand sketch (docs/spec/hardware.md, Commands to Firmware). */
export const skyCommandDialect: Tc4Dialect = {
  channels: SKYWALKER_CHANNELS,
  outputCommands: { heater: 'OT1', fan: 'OT2', cooling: 'COOL', filter: 'FILTER', drum: 'DRUM' },

  /** °C, then the protocol version: no reply means an older sketch, also a mismatch. */
  async handshake(link) {
    const units = await link.send('UNITS;C');
    if (!units.ok) return units;

    const version = await link.request('VERSION', isVersionReplyShape);
    if (!version.ok) {
      return version.error.kind === 'no-reply'
        ? err({ kind: 'version-mismatch', expected: SKYWALKER_PROTOCOL_VERSION, actual: null })
        : version;
    }
    const parsed = parseVersionReply(version.value);
    if (!parsed.ok) return parsed;
    return parsed.value === SKYWALKER_PROTOCOL_VERSION
      ? ok(undefined)
      : err({
          kind: 'version-mismatch',
          expected: SKYWALKER_PROTOCOL_VERSION,
          actual: parsed.value,
        });
  },

  // The sketch keeps its outputs; its 10 s watchdog switches them off when nothing is sent.
  outputsOffAfterHandshake: false,

  isReadReply: isReadReplyShape,

  parseRead(line) {
    const parsed = parseReadReply(line);
    if (!parsed.ok) return parsed;
    const { bt, heater, fan } = parsed.value;
    return ok({ sensors: { bt }, heater, fan });
  },

  safeStop: SKYWALKER_SAFE_STOP,
  // The sketch's own: heater 0, fan 100; drum, cooling and filter unchanged.
  fallbackStop: { command: 'ESTOP', leaves: { heater: 0, fan: 100 } },
};
