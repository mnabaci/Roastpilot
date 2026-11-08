// A minimal Chrome DevTools Protocol client for the Roastpilot window (Node's built-in fetch and
// WebSocket, no dependencies). The app must run with a debug port: see the ui-check skill.

const CALL_TIMEOUT_MS = 15_000;

interface Target {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

interface Reply {
  id?: number;
  result?: unknown;
  error?: { message: string };
}

export interface CdpSession {
  /** Sends one CDP command and resolves with its result; rejects on a CDP error or timeout. */
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
}

/** The app's page (not devtools or a worker) from the debug port's target list. */
export function pickPage(targets: readonly Target[]): Target | undefined {
  return targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
}

export async function connect(port: number): Promise<CdpSession> {
  let targets: Target[];
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    targets = (await res.json()) as Target[];
  } catch (error) {
    throw new Error(
      `No app on debug port ${port}. Start it as the ui-check skill says (${String(error)})`,
    );
  }
  const page = pickPage(targets);
  if (!page?.webSocketDebuggerUrl) throw new Error(`No Roastpilot window on port ${port}`);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => {
      resolve();
    });
    ws.addEventListener('error', () => {
      reject(new Error(`Couldn't open the CDP socket on port ${port}`));
    });
  });

  const pending = new Map<number, (reply: Reply) => void>();
  ws.addEventListener('message', (event) => {
    const reply = JSON.parse(String(event.data)) as Reply;
    if (reply.id !== undefined) pending.get(reply.id)?.(reply);
  });
  let nextId = 0;

  return {
    call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
      const id = ++nextId;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method} timed out after ${CALL_TIMEOUT_MS} ms`));
        }, CALL_TIMEOUT_MS);
        pending.set(id, (reply) => {
          clearTimeout(timer);
          pending.delete(id);
          if (reply.error) reject(new Error(`${method}: ${reply.error.message}`));
          else resolve(reply.result as T);
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}

interface EvaluateResult {
  result: { value?: unknown; description?: string };
  exceptionDetails?: { text: string; exception?: { description?: string } };
}

/** Evaluates an expression in the page (promises awaited) and returns its JSON value. */
export async function evaluate(session: CdpSession, expression: string): Promise<unknown> {
  const r = await session.call<EvaluateResult>('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    const detail = r.exceptionDetails.exception?.description ?? r.exceptionDetails.text;
    throw new Error(`The page threw: ${detail}`);
  }
  return r.result.value ?? r.result.description;
}
