// Finds the Roastpilot window on the app's debug port and talks to it through the shared CDP
// client (scripts/cdp.ts). The app must run with a debug port: see the ui-check skill.
import { Cdp } from '../cdp.ts';

interface Target {
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

/** The app's window, as far as the ui commands need it. */
export type CdpSession = Pick<Cdp, 'send' | 'close'>;

/** The app's page (not devtools or a worker) from the debug port's target list. */
export function pickPage(targets: readonly Target[]): Target | undefined {
  return targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
}

export async function connect(port: number): Promise<CdpSession> {
  let targets: Target[];
  try {
    const res = await fetch(`http://127.0.0.1:${String(port)}/json`);
    targets = (await res.json()) as Target[];
  } catch (error) {
    throw new Error(
      `No app on debug port ${String(port)}. Start it as the ui-check skill says (${String(error)})`,
    );
  }
  const page = pickPage(targets);
  if (!page?.webSocketDebuggerUrl) throw new Error(`No Roastpilot window on port ${String(port)}`);
  return Cdp.connect(page.webSocketDebuggerUrl);
}

interface EvaluateResult {
  result: { value?: unknown; description?: string };
  exceptionDetails?: { text: string; exception?: { description?: string } };
}

/** Evaluates an expression in the page (promises awaited) and returns its JSON value. */
export async function evaluate(session: CdpSession, expression: string): Promise<unknown> {
  const r = await session.send<EvaluateResult>('Runtime.evaluate', {
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
