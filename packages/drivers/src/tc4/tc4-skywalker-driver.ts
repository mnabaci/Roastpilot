import {
  quantize,
  serializeError,
  silentLogger,
  type Clock,
  type DriverError,
  type Logger,
  type RoasterDriver,
  type Transport,
} from '@roastpilot/core';
import {
  err,
  ok,
  type Channel,
  type OutputChannel,
  type Reading,
  type Result,
} from '@roastpilot/shared';
import { SKYWALKER_CHANNELS, SKYWALKER_PROTOCOL_VERSION, SKYWALKER_SAFE_STOP } from '../skywalker';
import { CommandQueue } from './command-queue';
import { parseReadReply, parseVersionReply, type ReadReply } from './replies';

/** Sketch command for each output channel (docs/spec/hardware.md, Commands). */
const OUTPUT_COMMANDS: Readonly<Record<string, string>> = {
  heater: 'OT1',
  fan: 'OT2',
  cooling: 'COOL',
  filter: 'FILTER',
  drum: 'DRUM',
};

export interface Tc4SkywalkerDriverOptions {
  transport: Transport;
  clock: Clock;
  logger?: Logger;
}

/** Adapter for the Skywalker roaster through the SkyCommand sketch over a line transport. */
export class Tc4SkywalkerDriver implements RoasterDriver {
  readonly channels: readonly Channel[] = SKYWALKER_CHANNELS;

  readonly #transport: Transport;
  readonly #clock: Clock;
  readonly #queue: CommandQueue;
  readonly #logger: Logger;
  readonly #outputs = new Map<string, OutputChannel>();
  /** Last value sent per output. READ only echoes heater and fan, so the rest come from here. */
  readonly #sent = new Map<string, number>();
  /** Echoed outputs that differ from what was sent: logged once when it starts and when it ends. */
  readonly #boardChanged = new Set<string>();
  #connected = false;

  constructor(options: Tc4SkywalkerDriverOptions) {
    this.#transport = options.transport;
    this.#clock = options.clock;
    this.#queue = new CommandQueue(options.transport, options.clock);
    this.#logger = options.logger ?? silentLogger;
    for (const channel of this.channels) {
      if (channel.kind === 'output') {
        this.#outputs.set(channel.id, channel);
        this.#sent.set(channel.id, 0);
      }
    }
    options.transport.onClose(() => {
      this.#connected = false;
    });
  }

  /** Opens the port, switches to °C, checks the protocol version and takes one reading. */
  async connect(): Promise<Result<void, DriverError>> {
    this.#connected = false;
    const opened = await this.#transport.open();
    if (!opened.ok) return err({ kind: 'disconnected' });

    const ready = await this.#handshake();
    if (!ready.ok) {
      await this.#transport.close();
      return ready;
    }
    this.#connected = true;
    return ok(undefined);
  }

  async read(): Promise<Result<Reading, DriverError>> {
    if (!this.#connected) return err({ kind: 'disconnected' });
    const parsed = await this.#readOnce();
    if (!parsed.ok) return parsed;
    const { reply, line } = parsed.value;
    this.#noteBoardChanges(reply, line);
    // Every channel in every reading (docs/spec/hardware.md): the reply wins for what it reports.
    return ok({
      atMs: this.#clock.now(),
      values: { ...Object.fromEntries(this.#sent), ...reply },
    });
  }

  async setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    if (!this.#connected) return err({ kind: 'disconnected' });
    return this.#sendOutput(channel, value);
  }

  /** Heater off, fan and cooling up; ESTOP if any step fails. Tries even when not connected. */
  async safeStop(): Promise<void> {
    try {
      let allSent = true;
      for (const [channel, value] of SKYWALKER_SAFE_STOP) {
        const sent = await this.#sendOutput(channel, value);
        allSent &&= sent.ok;
      }
      if (!allSent) {
        this.#logger.warn('driver.safe-stop-incomplete', { fallback: 'ESTOP' });
        const estop = await this.#queue.send('ESTOP');
        if (estop.ok) {
          this.#sent.set('heater', 0);
          this.#sent.set('fan', 100);
        } else {
          // Only the sketch's 10 s watchdog can switch the heater off now.
          this.#logger.error('driver.estop-failed', { error: estop.error });
        }
      }
    } catch (error) {
      // Nothing more to do from here: the sketch's 10 s watchdog switches everything off.
      this.#logger.error('driver.safe-stop-threw', { error: serializeError(error) });
    }
  }

  async disconnect(): Promise<void> {
    this.#connected = false;
    await this.#transport.close();
  }

  async #handshake(): Promise<Result<void, DriverError>> {
    const units = await this.#queue.send('UNITS;C');
    if (!units.ok) return units;

    const version = await this.#queue.request('VERSION');
    if (!version.ok) {
      return version.error.kind === 'no-reply'
        ? err({ kind: 'version-mismatch', expected: SKYWALKER_PROTOCOL_VERSION, actual: null })
        : version;
    }
    const parsed = parseVersionReply(version.value);
    if (!parsed.ok) return parsed;
    if (parsed.value !== SKYWALKER_PROTOCOL_VERSION) {
      return err({
        kind: 'version-mismatch',
        expected: SKYWALKER_PROTOCOL_VERSION,
        actual: parsed.value,
      });
    }

    const reading = await this.#readOnce();
    return reading.ok ? ok(undefined) : reading;
  }

  async #readOnce(): Promise<Result<{ reply: ReadReply; line: string }, DriverError>> {
    const answer = await this.#queue.request('READ');
    if (!answer.ok) return answer;
    const parsed = parseReadReply(answer.value);
    return parsed.ok ? ok({ reply: parsed.value, line: answer.value }) : parsed;
  }

  /**
   * The sketch echoes the heater and fan it is sending the roaster. When that isn't what we sent,
   * something else changed it (the sketch's own failsafe, or a garbled reply): log it with the raw
   * line, once per change, so the cause can be found (docs/spec/hardware.md).
   */
  #noteBoardChanges(reply: ReadReply, line: string): void {
    for (const channel of ['heater', 'fan'] as const) {
      const sent = this.#sent.get(channel);
      const reported = reply[channel];
      if (reported !== sent && !this.#boardChanged.has(channel)) {
        this.#boardChanged.add(channel);
        this.#logger.warn('driver.output-changed-by-board', { channel, sent, reported, line });
      } else if (reported === sent && this.#boardChanged.delete(channel)) {
        this.#logger.info('driver.output-matches-again', { channel, value: reported });
      }
    }
  }

  async #sendOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    const output = this.#outputs.get(channel);
    const command = OUTPUT_COMMANDS[channel];
    if (!output || !command) return err({ kind: 'unknown-channel', channel });
    const quantized = quantize(output, value);
    const sent = await this.#queue.send(`${command};${String(quantized)}`);
    if (sent.ok) this.#sent.set(channel, quantized);
    return sent;
  }
}
