import type { RendererLogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { forwardErrors } from './forward-errors';

function setup() {
  const sent: RendererLogEntry[] = [];
  const target = new EventTarget();
  forwardErrors(target, { log: (entry) => sent.push(entry) });
  return { target, sent };
}

describe('forwardErrors', () => {
  it('sends uncaught errors to the log', () => {
    const { target, sent } = setup();
    target.dispatchEvent(
      new ErrorEvent('error', { error: new Error('boom'), filename: 'App.tsx', lineno: 7 }),
    );
    expect(sent.map((e) => [e.level, e.event])).toEqual([['error', 'renderer.uncaught-error']]);
    expect(sent[0]?.context).toMatchObject({ message: 'boom', source: 'App.tsx', line: 7 });
  });

  it('sends unhandled rejections to the log', () => {
    const { target, sent } = setup();
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: 'nope' });
    target.dispatchEvent(event);
    expect(sent).toEqual([
      { level: 'error', event: 'renderer.unhandled-rejection', context: { value: 'nope' } },
    ]);
  });
});
