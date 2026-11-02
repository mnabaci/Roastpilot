import type { Clock, Transport, TransportError } from '@roastpilot/core';
import { err, ok, type Result } from '@roastpilot/shared';

export interface SentLine {
  atMs: number;
  line: string;
}

/** A scripted board for tests: `reply` decides what comes back for each line written. */
export class FakeTransport implements Transport {
  readonly sent: SentLine[] = [];
  reply: (line: string) => string | undefined = () => undefined;
  openResult: Result<void, TransportError> = ok(undefined);
  /** Makes matching writes fail as if the port hiccuped, without closing it. */
  failWrite: (line: string) => boolean = () => false;

  readonly #clock: Clock;
  readonly #lineListeners: ((line: string) => void)[] = [];
  readonly #closeListeners: (() => void)[] = [];
  #open = false;

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  open(): Promise<Result<void, TransportError>> {
    this.#open = this.openResult.ok;
    return Promise.resolve(this.openResult);
  }

  write(line: string): Promise<Result<void, TransportError>> {
    if (!this.#open) return Promise.resolve(err({ kind: 'disconnected', message: 'port closed' }));
    if (this.failWrite(line))
      return Promise.resolve(err({ kind: 'disconnected', message: 'write failed' }));
    this.sent.push({ atMs: this.#clock.now(), line });
    const answer = this.reply(line);
    if (answer !== undefined)
      queueMicrotask(() => {
        this.emit(answer);
      });
    return Promise.resolve(ok(undefined));
  }

  onLine(listener: (line: string) => void): void {
    this.#lineListeners.push(listener);
  }

  onClose(listener: () => void): void {
    this.#closeListeners.push(listener);
  }

  close(): Promise<void> {
    this.drop();
    return Promise.resolve();
  }

  /** A line from the board, asked for or not. */
  emit(line: string): void {
    for (const listener of this.#lineListeners) listener(line);
  }

  /** The cable is pulled. */
  drop(): void {
    if (!this.#open) return;
    this.#open = false;
    for (const listener of this.#closeListeners) listener();
  }

  sentLines(): string[] {
    return this.sent.map((s) => s.line);
  }
}
