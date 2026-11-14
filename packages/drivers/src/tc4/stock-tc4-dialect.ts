import type { DriverError } from '@roastpilot/core';
import { err, ok, type Channel, type Result, type Tc4Wiring } from '@roastpilot/shared';
import type { Tc4Dialect, Tc4Link, Tc4Reply } from './tc4-dialect';

/**
 * The stock TC4 firmware, aArtisanQ_PID (docs/spec/hardware.md, Stock TC4 firmware), checked
 * against its source and Artisan's own TC4 code. Built from the roaster record's wiring.
 */

/** The Arduino restarts when the port opens; Artisan waits 1 s before talking to it. */
export const TC4_BOOT_MS = 1500;

/** Reading every input at once: TC1–TC4 as logical channels 1–4. */
const ALL_INPUTS = 'CHAN;1234';

/**
 * `CHAN` always answers `# Active channels set to …` (cmndreader.cpp). Until it has, the board may
 * still be starting and would keep its boot mapping (TC2, TC1) and °F: so connect waits for it.
 */
const CHAN_ATTEMPTS = 3;
const isChanAck = (line: string) => line.trimStart().startsWith('# Active channels');

/**
 * The firmware's own filtering (`ET_FILTER`, `BT_FILTER` in user.h), sent on every connect: a board
 * that didn't restart keeps the level Artisan last set (its default `FILT;70,70,70,70`), which would
 * lag the readings Auto steers by. The app smooths what it draws itself.
 */
const FIRMWARE_FILTERS = 'FILT;10;10;10;10';

/**
 * Off on connect, so nothing runs unseen on a board that didn't restart: its PID first (it drives
 * OT1 on its own), then the heater's output, then every other output the firmware has.
 */
function allOff(wiring: Tc4Wiring): string[] {
  const outputs = [
    wiring.heaterOutput,
    ...['OT1', 'OT2', 'IO3'].filter((o) => o !== wiring.heaterOutput),
  ];
  return ['PID;OFF', ...outputs.map((output) => `${output};0`)];
}

const percent = { kind: 'output', unit: 'percent', min: 0, max: 100, step: 5 } as const;

/** `#` lines are the firmware's acknowledgements (`CHAN` always sends one): never a reply. */
const isAck = (line: string) => line.trimStart().startsWith('#');
const isStockReadReply = (line: string) => line.includes(',') && !isAck(line);

/** `CHAN;eb00`: ET on logical channel 1 (0 = none), BT on 2, so the reply has them in that order. */
export const chanCommand = (wiring: Tc4Wiring) =>
  `CHAN;${String(wiring.etInput)}${String(wiring.btInput)}00`;

function stockChannels(wiring: Tc4Wiring): Channel[] {
  return [
    { id: 'bt', kind: 'sensor', unit: 'celsius', name: 'Bean temperature', short: 'BT' },
    ...(wiring.etInput > 0
      ? [
          {
            id: 'et',
            kind: 'sensor',
            unit: 'celsius',
            name: 'Environment temperature',
            short: 'ET',
          } as const,
        ]
      : []),
    { id: 'heater', ...percent },
    { id: 'fan', ...percent },
  ];
}

/** Every field a number; an empty field is no value (Artisan reads it as −1). */
function numberFields(line: string): (number | null)[] | undefined {
  const fields = line.trim().split(',');
  const values = fields.map((f) => (f.trim() === '' ? null : Number(f)));
  return values.every((v) => v === null || Number.isFinite(v)) ? values : undefined;
}

/**
 * `ambient,[ET,]BT,heater,fan,setpoint`: what aArtisanQ_PID's `logger()` prints for the active
 * channels in `CHAN` order, then the heater and fan duty and the PID setpoint (0 while off).
 */
function parseStockRead(line: string, hasEt: boolean): Result<Tc4Reply, DriverError> {
  const values = numberFields(line);
  const expected = hasEt ? 6 : 5;
  if (values?.length !== expected) return err({ kind: 'bad-reply', line });
  const [et, bt, heater, fan] = hasEt ? values.slice(1, 5) : [null, ...values.slice(1, 4)];
  if (bt == null || heater == null || fan == null) return err({ kind: 'bad-reply', line });
  const sensors: Record<string, number> = et == null ? { bt } : { bt, et };
  return ok({ sensors, heater, fan });
}

/**
 * `ambient,TC1,TC2,TC3,TC4,heater,fan,setpoint` after `CHAN;1234`. A TC4 reads an open input as a
 * number too, so every input has one; the user tells probes apart by warming one.
 */
export function parseAllInputs(line: string): Result<(number | null)[], DriverError> {
  const values = numberFields(line);
  if (values?.length !== 8) return err({ kind: 'bad-reply', line });
  return ok(values.slice(1, 5));
}

/** `CHAN`, sent again until the board acknowledges it. */
async function setChannels(link: Tc4Link, command: string): Promise<Result<void, DriverError>> {
  let last: Result<string, DriverError> = err({ kind: 'no-reply', command });
  for (let attempt = 0; attempt < CHAN_ATTEMPTS; attempt++) {
    last = await link.request(command, isChanAck);
    if (last.ok || last.error.kind !== 'no-reply') break;
  }
  return last.ok ? ok(undefined) : last;
}

export function stockTc4Dialect(wiring: Tc4Wiring): Tc4Dialect {
  const hasEt = wiring.etInput > 0;
  return {
    channels: stockChannels(wiring),
    outputCommands: { heater: wiring.heaterOutput, fan: wiring.fanOutput },

    async handshake(link, clock) {
      await clock.delay(TC4_BOOT_MS);
      const chan = await setChannels(link, chanCommand(wiring));
      if (!chan.ok) return chan;
      for (const command of [...allOff(wiring), FIRMWARE_FILTERS, 'UNITS;C']) {
        const sent = await link.send(command);
        if (!sent.ok) return sent;
      }
      return ok(undefined);
    },

    outputsOffAfterHandshake: true,
    isReadReply: isStockReadReply,
    parseRead: (line) => parseStockRead(line, hasEt),

    safeStop: [
      ['heater', 0],
      ['fan', 100],
    ],
    // PID;STOP switches OT1 off and the fan to auto-cool, but leaves IO3 alone, or sets it to 100,
    // in most builds (cmndreader.cpp): a heater on IO3 gets its own 0 again instead.
    fallbackStop:
      wiring.heaterOutput === 'IO3'
        ? { command: 'IO3;0', leaves: { heater: 0 } }
        : { command: 'PID;STOP', leaves: { heater: 0 } },

    inputProbe: {
      select: ALL_INPUTS,
      restore: chanCommand(wiring),
      isReply: isStockReadReply,
      parse: parseAllInputs,
    },
  };
}
