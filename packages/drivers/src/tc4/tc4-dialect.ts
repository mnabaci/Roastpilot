import type { Clock, DriverError } from '@roastpilot/core';
import type { Channel, Result } from '@roastpilot/shared';
import type { ReplyMatcher } from './command-queue';

/** How a dialect talks to the board during its handshake: the driver's command queue. */
export interface Tc4Link {
  /** Sends a command that has no reply. */
  send(command: string): Promise<Result<void, DriverError>>;
  /** Sends a command and waits for the first line `accepts` takes as its reply. */
  request(command: string, accepts: ReplyMatcher): Promise<Result<string, DriverError>>;
}

/** What a `READ` reply holds: the sensors by channel id, and the heater and fan the board is sending. */
export interface Tc4Reply {
  readonly sensors: Readonly<Record<string, number>>;
  readonly heater: number;
  readonly fan: number;
}

/**
 * One kind of board that speaks Artisan's TC4 text protocol (ADR 0026, docs/spec/hardware.md):
 * plain data plus small functions. Everything else is `Tc4Driver`'s, the same for every dialect.
 */
export interface Tc4Dialect {
  /** What the board reads and controls, as the driver declares them. */
  readonly channels: readonly Channel[];
  /** The command for each output channel id, sent as `<command>;<value>`. */
  readonly outputCommands: Readonly<Record<string, string>>;
  /** Runs after the port opens and before the first `READ`; an error closes the port. */
  handshake(link: Tc4Link, clock: Clock): Promise<Result<void, DriverError>>;
  /** Which lines can answer `READ`; anything else waiting on the line is dropped. */
  readonly isReadReply: ReplyMatcher;
  parseRead(line: string): Result<Tc4Reply, DriverError>;
  /** Sent in this order on every safety trip. */
  readonly safeStop: readonly (readonly [channel: string, value: number])[];
  /** Sent when a safe-stop command fails, and the outputs it leaves the board at. */
  readonly fallbackStop: {
    readonly command: string;
    readonly leaves: Readonly<Record<string, number>>;
  };
  /** How to read every input at once, on a board whose wiring is the user's to find out. */
  readonly inputProbe?: Tc4InputProbe;
}

/** Switch to all inputs, read them, switch back (docs/spec/roasters.md, Generic TC4). */
export interface Tc4InputProbe {
  /** Makes every input a logical channel, e.g. `CHAN;1234`. */
  readonly select: string;
  /** Puts the record's channels back. */
  readonly restore: string;
  readonly isReply: ReplyMatcher;
  /** °C per input; null for one with no value. */
  parse(line: string): Result<(number | null)[], DriverError>;
}

/**
 * A dialect's safety data must name its own outputs (ADR 0026): a typo would turn every safe stop
 * into the fallback, or put a stray value into every reading. A programmer error, so it throws.
 */
export function checkDialect(dialect: Tc4Dialect): void {
  const outputs = new Set(dialect.channels.filter((c) => c.kind === 'output').map((c) => c.id));
  const sensors = dialect.channels.filter((c) => c.kind === 'sensor').map((c) => c.id);
  const drives = (channel: string) =>
    outputs.has(channel) && dialect.outputCommands[channel] !== undefined;
  const problems = [
    ...dialect.safeStop.filter(([channel]) => !drives(channel)).map(([c]) => `safe stop: ${c}`),
    ...Object.keys(dialect.fallbackStop.leaves)
      .filter((channel) => !outputs.has(channel))
      .map((c) => `fallback leaves: ${c}`),
    ...sensors.filter((id) => outputs.has(id)).map((id) => `sensor named like an output: ${id}`),
    ...(dialect.safeStop.some(([channel, value]) => channel === 'heater' && value === 0)
      ? []
      : ['safe stop never sets the heater to 0']),
  ];
  if (problems.length > 0) throw new Error(`Bad TC4 dialect: ${problems.join('; ')}`);
}
