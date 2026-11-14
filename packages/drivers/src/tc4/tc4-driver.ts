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
import { CommandQueue } from './command-queue';
import { checkDialect, type Tc4Dialect, type Tc4Reply } from './tc4-dialect';

export interface Tc4DriverOptions {
  dialect: Tc4Dialect;
  transport: Transport;
  clock: Clock;
  logger?: Logger;
}

/**
 * Adapter for a board that speaks Artisan's TC4 text protocol over a line transport (ADR 0026).
 * What differs between boards is its dialect; the queue, polling and checks are the same for all.
 */
export class Tc4Driver implements RoasterDriver {
  readonly channels: readonly Channel[];

  readonly #dialect: Tc4Dialect;
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

  constructor(options: Tc4DriverOptions) {
    checkDialect(options.dialect);
    this.#dialect = options.dialect;
    this.channels = options.dialect.channels;
    this.#transport = options.transport;
    this.#clock = options.clock;
    this.#logger = options.logger ?? silentLogger;
    this.#queue = new CommandQueue(options.transport, options.clock, this.#logger);
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

  /** Opens the port, runs the dialect's handshake and takes one reading. */
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
      values: {
        ...Object.fromEntries(this.#sent),
        ...reply.sensors,
        heater: reply.heater,
        fan: reply.fan,
      },
    });
  }

  async setOutput(channel: string, value: number): Promise<Result<void, DriverError>> {
    if (!this.#connected) return err({ kind: 'disconnected' });
    return this.#sendOutput(channel, value);
  }

  /**
   * The dialect's safe-stop sequence; its fallback if any step fails. Tries even when not connected.
   * When even that fails there is nothing more to send: only a board watchdog, where it has one, or
   * a person can stop it now.
   */
  async safeStop(): Promise<void> {
    try {
      let allSent = true;
      for (const [channel, value] of this.#dialect.safeStop) {
        const sent = await this.#sendOutput(channel, value);
        allSent &&= sent.ok;
      }
      if (!allSent) {
        const { command, leaves } = this.#dialect.fallbackStop;
        this.#logger.warn('driver.safe-stop-incomplete', { fallback: command });
        const fallback = await this.#queue.send(command);
        if (fallback.ok) {
          for (const [channel, value] of Object.entries(leaves)) this.#sent.set(channel, value);
        } else {
          this.#logger.error('driver.fallback-stop-failed', { command, error: fallback.error });
        }
      }
    } catch (error) {
      this.#logger.error('driver.safe-stop-threw', { error: serializeError(error) });
    }
  }

  async disconnect(): Promise<void> {
    this.#connected = false;
    await this.#transport.close();
  }

  async #handshake(): Promise<Result<void, DriverError>> {
    const ready = await this.#dialect.handshake(this.#queue, this.#clock);
    if (!ready.ok) return ready;
    const reading = await this.#readOnce();
    return reading.ok ? ok(undefined) : reading;
  }

  async #readOnce(): Promise<Result<{ reply: Tc4Reply; line: string }, DriverError>> {
    const answer = await this.#queue.request('READ', this.#dialect.isReadReply);
    if (!answer.ok) return answer;
    const parsed = this.#dialect.parseRead(answer.value);
    return parsed.ok ? ok({ reply: parsed.value, line: answer.value }) : parsed;
  }

  /**
   * The board echoes the heater and fan it is sending. When that isn't what we sent, something
   * else changed it (the board's own failsafe, or a garbled reply): log it with the raw
   * line, once per change, so the cause can be found (docs/spec/hardware.md).
   */
  #noteBoardChanges(reply: Tc4Reply, line: string): void {
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
    const command = this.#dialect.outputCommands[channel];
    if (!output || !command) return err({ kind: 'unknown-channel', channel });
    const quantized = quantize(output, value);
    const sent = await this.#queue.send(`${command};${String(quantized)}`);
    if (sent.ok) this.#sent.set(channel, quantized);
    return sent;
  }
}
