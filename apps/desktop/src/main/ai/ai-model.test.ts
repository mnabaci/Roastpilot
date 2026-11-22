import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { askChain, type ModelChain } from './ai-model';

const CHAIN: ModelChain = [
  { id: 'small-2', label: 'Small 2' },
  { id: 'big-2', label: 'Big 2' },
];
const GONE = Object.assign(new Error('model: small-2'), { gone: true });
const isGone = (error: unknown) => (error as { gone?: boolean } | undefined)?.gone === true;

function setup(ask: (id: string) => Promise<string>) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const asked = vi.fn((model: { id: string }) => ask(model.id));
  const run = () =>
    askChain({
      chain: CHAIN,
      isGone,
      ask: asked,
      logger,
      context: { helper: 'taste', provider: 'alpha' },
    });
  return { run, asked, entries };
}

describe('askChain', () => {
  it('asks the first model and no other when it answers', async () => {
    const { run, asked, entries } = setup((id) => Promise.resolve(`from ${id}`));
    expect(await run()).toEqual({ answered: true, value: 'from small-2' });
    expect(asked).toHaveBeenCalledTimes(1);
    expect(entries).toEqual([]);
  });

  it('asks the next model when the first is gone, and logs which one', async () => {
    const { run, asked, entries } = setup((id) =>
      id === 'small-2' ? Promise.reject(GONE) : Promise.resolve(`from ${id}`),
    );
    expect(await run()).toEqual({ answered: true, value: 'from big-2' });
    expect(asked.mock.calls.map(([model]) => model.id)).toEqual(['small-2', 'big-2']);
    expect(entries.map((e) => [e.event, e.context])).toEqual([
      ['ai.model-gone', { helper: 'taste', provider: 'alpha', model: 'small-2' }],
    ]);
  });

  it('says none answered when every model is gone', async () => {
    const { run, entries } = setup(() => Promise.reject(GONE));
    expect(await run()).toEqual({ answered: false });
    expect(entries.map((e) => e.event)).toEqual(['ai.model-gone', 'ai.model-gone']);
  });

  it('throws any other failure on without trying the next model', async () => {
    const { run, asked } = setup(() => Promise.reject(new Error('offline')));
    await expect(run()).rejects.toThrow('offline');
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('remembers nothing: the next read asks the first model again', async () => {
    let gone = true;
    const { run } = setup((id) =>
      id === 'small-2' && gone ? Promise.reject(GONE) : Promise.resolve(`from ${id}`),
    );
    expect(await run()).toEqual({ answered: true, value: 'from big-2' });
    gone = false;
    expect(await run()).toEqual({ answered: true, value: 'from small-2' });
  });
});
