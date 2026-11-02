import type { Clock, DriverError, Transport } from '@roastpilot/core';
import { err, ok, type Result } from '@roastpilot/shared';

/** The sketch merges commands that arrive within 100 ms (docs/spec/hardware.md). */
export const COMMAND_GAP_MS = 150;
export const REPLY_TIMEOUT_MS = 500;

type ReplyListener = (line: string | null) => void;

/**
 * Sends one command at a time: the next goes out only after the gap, or as soon as the previous
 * command's reply arrived. Never throws; every outcome is a Result.
 */
export class CommandQueue {
  readonly #transport: Transport;
  readonly #clock: Clock;
  #tail: Promise<unknown> = Promise.resolve();
  #nextWriteAtMs = Number.NEGATIVE_INFINITY;
  #awaitingReply: ReplyListener | undefined;

  constructor(transport: Transport, clock: Clock) {
    this.#transport = transport;
    this.#clock = clock;
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

  /** Sends a command and resolves with its one-line reply. */
  request(command: string): Promise<Result<string, DriverError>> {
    return this.#enqueue(async () => {
      await this.#waitForGap();
      // Listen only from the moment of writing, so a stray line during the gap isn't taken as the reply.
      const reply = new Promise<string | null>((resolve) => {
        this.#awaitingReply = resolve;
      });
      const written = await this.#writeNow(command);
      if (!written.ok) {
        this.#awaitingReply = undefined;
        return written;
      }
      const timeout = this.#clock.delay(REPLY_TIMEOUT_MS).then(() => 'timeout' as const);
      const outcome = await Promise.race([reply, timeout]);
      this.#awaitingReply = undefined;
      if (outcome === 'timeout') {
        // The sketch may still be busy; keep the gap so a late reply can't merge with the next command.
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
    const written = await this.#transport.write(command);
    return written.ok ? ok(undefined) : err({ kind: 'disconnected' });
  }

  #takeReply(line: string | null): void {
    const listener = this.#awaitingReply;
    this.#awaitingReply = undefined;
    // Lines nobody asked for (startup noise, late replies) are dropped.
    listener?.(line);
  }
}
