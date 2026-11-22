import { createLogger } from '@roastpilot/core';
import { TASTE_TAGS, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  APIConnectionError,
  APITimeoutError,
  APIUserAbortError,
  NotFoundError,
} from '@typesafe-ai/sdk';
import { JEV_MODELS, JEV_TICK_AT, JevTasteReader, type JevAsk } from './jev-taste-reader';

/** TypeSafe's answer to a model it doesn't have. */
const goneError = () => new NotFoundError(404, { error: 'model not found' }, new Headers());

const allNo = () => Object.fromEntries(TASTE_TAGS.map((tag) => [tag, { noul: 0.05 }]));

function setup(answer: Parameters<typeof vi.fn>[0]) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const ask = vi.fn(answer);
  const askWith = vi.fn(() => ask as unknown as JevAsk);
  const reader = new JevTasteReader(logger, JEV_MODELS, askWith);
  return { reader, ask, askWith, entries };
}

describe('JevTasteReader', () => {
  it('asks one question per tag about the words, with the key', async () => {
    const { reader, ask, askWith } = setup(() => Promise.resolve(allNo()));
    await reader.readTaste('tart', 'ts-key');
    expect(askWith).toHaveBeenCalledWith('ts-key');
    const [{ model, state, questions, signal }] = ask.mock.calls[0] as unknown as [
      { model: string; state: string; questions: Record<string, unknown>; signal: unknown },
    ];
    expect(model).toBe('jev-1.14.0');
    expect(reader.modelName).toBe('Jev 1.14');
    expect(state).toBe('tart');
    expect(Object.keys(questions)).toEqual([...TASTE_TAGS]);
    expect(questions.sour).toMatchObject({ type: 'noul' });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('ticks tags at the threshold or above, in their order', async () => {
    const { reader } = setup(() =>
      Promise.resolve({
        ...allNo(),
        roasty: { noul: 0.91 },
        sour: { noul: JEV_TICK_AT },
        thin: { noul: JEV_TICK_AT - 0.01 },
      }),
    );
    expect(await reader.readTaste('words', 'k')).toEqual({ ok: true, value: ['sour', 'roasty'] });
  });

  it('ticks nothing when every answer is no', async () => {
    const { reader } = setup(() => Promise.resolve(allNo()));
    expect(await reader.readTaste('words', 'k')).toEqual({ ok: true, value: [] });
  });

  it.each([
    [
      'an answer missing',
      () => {
        const a: Record<string, unknown> = allNo();
        delete a.flat;
        return a;
      },
    ],
    ['a probability above 1', () => ({ ...allNo(), sour: { noul: 1.2 } })],
    ['a probability that is not a number', () => ({ ...allNo(), sour: { noul: 'yes' } })],
  ])('calls %s unreadable', async (_name, answers) => {
    const { reader, entries } = setup(() => Promise.resolve(answers()));
    expect(await reader.readTaste('words', 'k')).toEqual({
      ok: false,
      error: { kind: 'unreadable', provider: 'jev' },
    });
    expect(entries.map((e) => e.event)).toEqual(['ai.read-failed']);
  });

  it('says retired when its model is gone, and logs which', async () => {
    const { reader, entries } = setup(() => Promise.reject(goneError()));
    expect(await reader.readTaste('words', 'k')).toEqual({
      ok: false,
      error: { kind: 'model-retired', provider: 'jev' },
    });
    expect(entries.map((e) => [e.event, e.context?.model])).toEqual([
      ['ai.model-gone', 'jev-1.14.0'],
      ['ai.read-failed', undefined],
    ]);
  });

  it.each([
    ['no connection', new APIConnectionError('down'), 'offline'],
    ['a timeout', new APITimeoutError(15_000), 'offline'],
    ['the hard stop', new APIUserAbortError('stopped'), 'offline'],
    ['a refused key', Object.assign(new Error('no'), { status: 401 }), 'key-refused'],
    ['too many requests', Object.assign(new Error('slow'), { status: 429 }), 'rate-limited'],
    ['overloaded', Object.assign(new Error('busy'), { status: 529 }), 'rate-limited'],
    ['an invalid question', Object.assign(new Error('bad'), { status: 422 }), 'failed'],
    ['anything else', new Error('boom'), 'failed'],
  ])('maps %s to %s, never logging the key or words', async (_name, error, kind) => {
    const { reader, entries } = setup(() => Promise.reject(error));
    expect(await reader.readTaste('secret words', 'ts-secret')).toEqual({
      ok: false,
      error: { kind, provider: 'jev' },
    });
    const logged = JSON.stringify(entries);
    expect(logged).not.toContain('ts-secret');
    expect(logged).not.toContain('secret words');
  });
});
