import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@roastpilot/core';
import type { LogEntry, RawSpecSheet } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeReader, type ClaudeParse } from './claude-reader';
import { CLAUDE_MODELS, type ClaudeModel } from './claude-models';
import type { ModelChain } from './ai-model';

const SHEET: RawSpecSheet = {
  name: 'Guji',
  origin: 'Ethiopia',
  process: 'natural',
  species: null,
  variety: null,
  altitudeMinM: 1800,
  altitudeMaxM: 2000,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: null,
  supplier: null,
  supplierWebsite: null,
  supplierEmail: null,
  supplierPhone: null,
  tastingNotes: [],
};

function setup(
  answer: (params: { model: string }) => Promise<unknown>,
  models: ModelChain<ClaudeModel> = CLAUDE_MODELS.taste,
) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const parse = vi.fn(answer);
  const parseWith = vi.fn(() => parse as unknown as ClaudeParse);
  return { reader: new ClaudeReader(logger, models, parseWith), parse, parseWith, entries };
}

const answered =
  (parsed: unknown, stopReason = 'end_turn') =>
  () =>
    Promise.resolve({ stop_reason: stopReason, parsed_output: parsed });
// SDKs reject with their own error objects; a test may also reject with a non-Error on purpose.
// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
const thrown = (error: unknown) => () => Promise.reject(error);

/** The API's answer to a model that is retired, or not on the key's account. */
const gone = (model: string) =>
  new Anthropic.NotFoundError(
    404,
    { type: 'error', error: { type: 'not_found_error', message: `model: ${model}` } },
    undefined,
    new Headers(),
  );

/** The models each call asked, in order. */
const modelsAsked = (parse: { mock: { calls: unknown[][] } }) =>
  parse.mock.calls.map(([params]) => (params as { model: string }).model);

/** The read's hard stop, as the service passes it: not aborted. */
const SIGNAL = new AbortController().signal;

describe('ClaudeReader', () => {
  it('reads tags in their order with the key it was given, by Haiku at low effort', async () => {
    const { reader, parse, parseWith } = setup(answered({ tags: ['thin', 'sour'] }));
    expect(reader.modelName).toBe('Haiku 5.5');
    expect(await reader.readTaste('tart and watery', 'sk-ant-123', SIGNAL)).toEqual({
      ok: true,
      value: ['sour', 'thin'],
    });
    expect(parseWith).toHaveBeenCalledWith('sk-ant-123');
    const [params, options] = parse.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    expect(params).toMatchObject({
      model: 'claude-haiku-5-5',
      messages: [{ role: 'user', content: 'tart and watery' }],
      output_config: { effort: 'low' },
    });
    // Haiku takes no server-side refusal fallback: sending one would be refused.
    expect(params).not.toHaveProperty('fallbacks');
    expect(params).not.toHaveProperty('betas');
    expect(options).toMatchObject({ timeout: 15_000 });
    expect((options as { signal?: unknown }).signal).toBeInstanceOf(AbortSignal);
  });

  it('reads no tags when none fit', async () => {
    const { reader } = setup(answered({ tags: [] }));
    expect(await reader.readTaste('nice cup', 'k', SIGNAL)).toEqual({ ok: true, value: [] });
  });

  it('reads a sheet with Opus, the refusal fallback on', async () => {
    const { reader, parse } = setup(answered(SHEET), CLAUDE_MODELS.specSheet);
    expect(reader.modelName).toBe('Opus 5.5');
    await reader.readSpecSheet({ kind: 'text', text: 'Guji' }, 'k', SIGNAL);
    expect(parse.mock.calls[0]?.[0]).toMatchObject({
      model: 'claude-opus-5-5',
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
  });

  it('asks Sonnet when Haiku is retired, and logs the model that was gone', async () => {
    const { reader, parse, entries } = setup((params) =>
      params.model === 'claude-haiku-5-5'
        ? Promise.reject(gone(params.model))
        : answered({ tags: ['sour'] })(),
    );
    expect(await reader.readTaste('tart', 'k', SIGNAL)).toEqual({ ok: true, value: ['sour'] });
    expect(modelsAsked(parse)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    expect(parse.mock.calls[1]?.[0]).toMatchObject({ fallbacks: 'default' });
    expect(entries.map((e) => [e.event, e.context?.model])).toEqual([
      ['ai.model-gone', 'claude-haiku-5-5'],
    ]);
  });

  it('says retired when every model is gone, and shares one hard stop', async () => {
    const { reader, parse, entries } = setup((params) => Promise.reject(gone(params.model)));
    expect(await reader.readTaste('tart', 'k', SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'model-retired', provider: 'claude' },
    });
    // Every model is asked under the read's one hard stop, the service's.
    const calls = parse.mock.calls as unknown as [unknown, { signal: unknown }][];
    expect(calls.map(([, options]) => options.signal)).toEqual([SIGNAL, SIGNAL]);
    expect(entries.map((e) => e.event)).toEqual([
      'ai.model-gone',
      'ai.model-gone',
      'ai.read-failed',
    ]);
  });

  it('reads a sheet with Sonnet when Opus is retired', async () => {
    const { reader, parse } = setup(
      (params) =>
        params.model === 'claude-opus-5-5' ? Promise.reject(gone(params.model)) : answered(SHEET)(),
      CLAUDE_MODELS.specSheet,
    );
    expect(await reader.readSpecSheet({ kind: 'text', text: 'Guji' }, 'k', SIGNAL)).toEqual({
      ok: true,
      value: SHEET,
    });
    expect(modelsAsked(parse)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
  });

  it('gives up as offline when the hard stop ends the read partway down the chain', async () => {
    const { reader, parse } = setup((params) =>
      Promise.reject(
        params.model === 'claude-haiku-5-5'
          ? gone(params.model)
          : new Anthropic.APIUserAbortError(),
      ),
    );
    expect(await reader.readTaste('tart', 'k', SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'offline', provider: 'claude' },
    });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('asks no other model after a 404 that is not a missing model', async () => {
    const notFound = new Anthropic.NotFoundError(404, undefined, 'gone', new Headers());
    const { reader, parse } = setup(thrown(notFound));
    expect(await reader.readTaste('tart', 'k', SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'failed', provider: 'claude' },
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('sends pasted text as text, and a PDF as a base64 document', async () => {
    const { reader, parse } = setup(answered(SHEET), CLAUDE_MODELS.specSheet);
    expect(
      await reader.readSpecSheet({ kind: 'text', text: 'Guji, natural' }, 'k', SIGNAL),
    ).toEqual({
      ok: true,
      value: SHEET,
    });
    await reader.readSpecSheet(
      { kind: 'pdf', bytes: new Uint8Array([37, 80, 68, 70]) },
      'k',
      SIGNAL,
    );
    const pdfCall = parse.mock.calls[1] as unknown as [{ messages: { content: unknown }[] }];
    expect(pdfCall[0].messages[0]?.content).toEqual([
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERg==' },
      },
    ]);
  });

  it.each([
    ['a refusal', answered({ tags: ['sour'] }, 'refusal')],
    ['an answer cut short', answered({ tags: ['sour'] }, 'max_tokens')],
    ['no parsed answer', answered(null)],
    ['an answer that is not the shape', answered({ tags: ['smoky'] })],
  ])('calls %s unreadable and logs it', async (_name, answer) => {
    const { reader, entries } = setup(answer);
    expect(await reader.readTaste('words', 'k', SIGNAL)).toEqual({
      ok: false,
      error: { kind: 'unreadable', provider: 'claude' },
    });
    expect(entries.map((e) => e.event)).toEqual(['ai.read-failed']);
  });

  it.each([
    ['no connection', new Anthropic.APIConnectionError({ message: 'down' }), 'offline'],
    ['a timeout', new Anthropic.APIConnectionTimeoutError(), 'offline'],
    ['the hard stop', new Anthropic.APIUserAbortError(), 'offline'],
    ['a refused key', Object.assign(new Error('no'), { status: 401 }), 'key-refused'],
    ['no permission', Object.assign(new Error('no'), { status: 403 }), 'key-refused'],
    ['too many requests', Object.assign(new Error('slow'), { status: 429 }), 'rate-limited'],
    ['overloaded', Object.assign(new Error('busy'), { status: 529 }), 'rate-limited'],
    ['a bad request', Object.assign(new Error('bad'), { status: 400 }), 'failed'],
    ['anything else', new Error('boom'), 'failed'],
    ['a thrown string', 'boom', 'failed'],
    [
      'an answer the SDK could not parse (a refusal or a cut-off)',
      new Anthropic.AnthropicError('Failed to parse structured output'),
      'unreadable',
    ],
  ])('maps %s to %s, logging the status but never the key or words', async (_n, error, kind) => {
    const { reader, entries } = setup(thrown(error));
    expect(await reader.readTaste('secret tasting words', 'sk-ant-secret', SIGNAL)).toEqual({
      ok: false,
      error: { kind, provider: 'claude' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.context).toMatchObject({ helper: 'taste', provider: 'claude', kind });
    const logged = JSON.stringify(entries);
    expect(logged).not.toContain('sk-ant-secret');
    expect(logged).not.toContain('secret tasting words');
  });
});
