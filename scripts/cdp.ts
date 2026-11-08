// A minimal Chrome DevTools Protocol client over Node's own WebSocket, shared by
// scripts/screenshots.ts and scripts/ui/ (the ui-check skill), so the repo needs no
// browser-automation dependency.

/** A command with no answer by then has failed (a page that hangs, a closed tab). */
const CALL_TIMEOUT_MS = 30_000;

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface Reply {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

export class Cdp {
  readonly #socket: WebSocket;
  readonly #pending = new Map<number, Pending>();
  #nextId = 0;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      const reply = JSON.parse(event.data) as Reply;
      // Only a whole-number id of a call this client made picks a handler; events are ignored.
      if (typeof reply.id !== 'number' || !Number.isInteger(reply.id)) return;
      const pending = this.#pending.get(reply.id);
      if (pending === undefined) return;
      this.#pending.delete(reply.id);
      if (reply.error) pending.reject(new Error(reply.error.message));
      else pending.resolve(reply.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.#pending.values()) pending.reject(new Error('DevTools closed'));
      this.#pending.clear();
    });
  }

  static connect(url: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener('open', () => {
        resolve(new Cdp(socket));
      });
      socket.addEventListener('error', () => {
        reject(new Error(`Couldn't reach DevTools at ${url}`));
      });
    });
  }

  /** Sends one command, to the browser or (with `sessionId`) to one page, and waits for the answer. */
  send<T>(method: string, params: object = {}, sessionId?: string): Promise<T> {
    const id = ++this.#nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method} timed out after ${String(CALL_TIMEOUT_MS)} ms`));
      }, CALL_TIMEOUT_MS);
      this.#pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(new Error(`${method}: ${error.message}`));
        },
      });
      this.#socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  close(): void {
    this.#socket.close();
  }
}
