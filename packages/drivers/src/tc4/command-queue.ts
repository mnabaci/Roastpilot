import {
  silentLogger,
  type Clock,
  type DriverError,
  type Logger,
  type Transport,
} from '@roastpilot/core';
import { err, ok, type Result } from '@roastpilot/shared';

/** The sketch keeps every line; a short gap just keeps writes apart (docs/spec/hardware.md). */
export const COMMAND_GAP_MS = 20;
/** Measured replies take under 150 ms; worst case ~750 ms when the roaster is silent. Inside the 3 s lost-connection rule. */
export const REPLY_TIMEOUT_MS = 1500;
/** A write the port never finishes counts as a lost connection, so it can't hold up a safe stop. */
export const WRITE_TIMEOUT_MS = 1000;

/** Says whether a line is the reply to the request waiting for it. */
export type ReplyMatcher = (line: string) => boolean;

interface PendingRequest {
  command: string;
  accepts: ReplyMatcher;
  /** A matching line, or null when the port closed. */
  resolve: (line: string | null) => void;
}

/**
 * Sends one command at a time: the next goes out only after the gap, or as soon as the previous
 * command's reply arrived. Never throws; every outcome is a Result.
 */
export class CommandQueue {
  readonly #transport: Transport;
  readonly #clock: Clock;
  #tail: Promise<unknown> = Promise.resolve();
  #nextWriteAtMs = Number.NEGATIVE_INFINITY;
  readonly #logger: Logger;
  #pending: PendingRequest | undefined;

  constructor(transport: Transport, clock: Clock, logger: Logger = silentLogger) {
    this.#transport = transport;
    this.#clock = clock;
    this.#logger = logger;
    transport.onLine((line) => {
      this.#takeReply(line);
    });
    transport.onClose(() => {
      this.#takeReply(null);
    });
  }

  /** Sends a command that has no reply. */
  send(command: string): Promise<Result<void, DriverError>> {
    return this.#enqueue(async () => {
      await this.#waitForGap();
      const written = await this.#writeNow(command);
      if (written.ok) this.#nextWriteAtMs = this.#clock.now() + COMMAND_GAP_MS;
      return written;
    });
  }

  /**
   * Sends a command and resolves with the first line `accepts` takes as its reply. Other lines
   * (another command's late reply, noise) are dropped and the request keeps waiting until its
   * own reply or the timeout.
   */
  request(command: string, accepts: ReplyMatcher): Promise<Result<string, DriverError>> {
    return this.#enqueue(async () => {
      await this.#waitForGap();
      // Listen only from the moment of writing, so a stray line during the gap isn't taken as the reply.
      const reply = new Promise<string | null>((resolve) => {
        this.#pending = { command, accepts, resolve };
      });
      const written = await this.#writeNow(command);
      if (!written.ok) {
        this.#pending = undefined;
        return written;
      }
      const timeout = this.#clock.delay(REPLY_TIMEOUT_MS).then(() => 'timeout' as const);
      const outcome = await Promise.race([reply, timeout]);
      this.#pending = undefined;
      if (outcome === 'timeout') {
        // The gap after a timeout is also a quarantine: nobody listens, so a late reply landing in
        // it is dropped. The matcher can't tell a late READ reply from the next READ's own (same
        // shape), so this gap is the only guard for a repeat of the same command.
        this.#nextWriteAtMs = this.#clock.now() + COMMAND_GAP_MS;
        return err({ kind: 'no-reply', command });
      }
      if (outcome === null) return err({ kind: 'disconnected' });
      return ok(outcome);
    });
  }

  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#tail.then(task);
    // A transport that throws instead of returning a Result must not jam every later command.
    this.#tail = run.catch(() => undefined);
    return run;
  }

  async #waitForGap(): Promise<void> {
    const waitMs = this.#nextWriteAtMs - this.#clock.now();
    if (waitMs > 0) await this.#clock.delay(waitMs);
  }

  async #writeNow(command: string): Promise<Result<void, DriverError>> {
    const timeout = this.#clock.delay(WRITE_TIMEOUT_MS).then(() => 'timeout' as const);
    const written = await Promise.race([this.#transport.write(command), timeout]);
    return written !== 'timeout' && written.ok ? ok(undefined) : err({ kind: 'disconnected' });
  }

  #takeReply(line: string | null): void {
    const pending = this.#pending;
    if (line === null) {
      this.#pending = undefined;
      pending?.resolve(null);
      return;
    }
    if (!pending) {
      // Startup noise, or a late reply arriving between requests.
      this.#logger.debug('driver.unrequested-line-dropped', { line });
      return;
    }
    if (!pending.accepts(line)) {
      // Another command's late reply: taking it would hand this request the wrong data.
      this.#logger.debug('driver.unmatched-line-dropped', { command: pending.command, line });
      return;
    }
    this.#pending = undefined;
    pending.resolve(line);
  }
}
