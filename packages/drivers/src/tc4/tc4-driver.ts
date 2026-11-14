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
import { BoardEcho } from './board-echo';
import { CommandQueue } from './command-queue';
import { readAllInputs } from './read-all-inputs';
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
  readonly #echo: BoardEcho;
  #connected = false;
  /** Reads run one at a time, so a poll never lands between a probe's `CHAN` and its `READ`. */
  #reads: Promise<unknown> = Promise.resolve();
  #pendingReads = 0;

  constructor(options: Tc4DriverOptions) {
    checkDialect(options.dialect);
    this.#dialect = options.dialect;
    this.channels = options.dialect.channels;
    this.#transport = options.transport;
    this.#clock = options.clock;
    this.#logger = options.logger ?? silentLogger;
    this.#echo = new BoardEcho(this.#logger);
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

  read(): Promise<Result<Reading, DriverError>> {
    return this.#oneRead(() => this.#read());
  }

  /**
   * Every input's temperature, for picking probes by their readings (docs/spec/roasters.md): the
   * dialect's probe, then its channels back. `unknown-channel` on a board that has no probe.
   */
  readInputs(): Promise<Result<(number | null)[], DriverError>> {
    return this.#oneRead(async () => {
      const probe = this.#dialect.inputProbe;
      if (!probe) return err({ kind: 'unknown-channel', channel: 'inputs' });
      if (!this.#connected) return err({ kind: 'disconnected' });
      return readAllInputs(this.#queue, probe);
    });
  }

  async #read(): Promise<Result<Reading, DriverError>> {
    if (!this.#connected) return err({ kind: 'disconnected' });
    const parsed = await this.#readOnce();
    if (!parsed.ok) return parsed;
    const { reply, line } = parsed.value;
    this.#echo.note(reply, this.#sent, line);
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

  /** The dialect's safe-stop sequence; its fallback if any step fails. Tries even when not connected. */
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
          // Nothing more to send: only a board watchdog, where it has one, or a person can stop it now.
          this.#logger.error('driver.estop-failed', { command, error: fallback.error });
        }
      }
    } catch (error) {
      // Nothing more to send: only a board watchdog, where it has one, or a person can stop it now.
      this.#logger.error('driver.safe-stop-threw', { error: serializeError(error) });
    }
  }

  /** Starts at once when no read is pending, so a read keeps its place in the command queue. */
  #oneRead<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#pendingReads === 0 ? task() : this.#reads.then(task);
    this.#pendingReads++;
    // A read that fails must not jam the ones after it.
    this.#reads = run
      .catch(() => undefined)
      .finally(() => {
        this.#pendingReads--;
      });
    return run;
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
