import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '@roastpilot/core';
import type { LogEntry, RawSpecSheet } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { CLAUDE_MODEL, ClaudeReader, type ClaudeParse } from './claude-reader';

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
  tastingNotes: [],
};

function setup(answer: () => Promise<unknown>) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const parse = vi.fn(answer);
  const parseWith = vi.fn(() => parse as unknown as ClaudeParse);
  return { reader: new ClaudeReader(logger, parseWith), parse, parseWith, entries };
}

const answered =
  (parsed: unknown, stopReason = 'end_turn') =>
  () =>
    Promise.resolve({ stop_reason: stopReason, parsed_output: parsed });
// SDKs reject with their own error objects; a test may also reject with a non-Error on purpose.
// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
const thrown = (error: unknown) => () => Promise.reject(error);

describe('ClaudeReader', () => {
  it('reads tags in their order with the key it was given', async () => {
    const { reader, parse, parseWith } = setup(answered({ tags: ['thin', 'sour'] }));
    expect(await reader.readTaste('tart and watery', 'sk-ant-123')).toEqual({
      ok: true,
      value: ['sour', 'thin'],
    });
    expect(parseWith).toHaveBeenCalledWith('sk-ant-123');
    const [params, options] = parse.mock.calls[0] as unknown as [Record<string, unknown>, unknown];
    expect(params).toMatchObject({
      model: CLAUDE_MODEL,
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
      messages: [{ role: 'user', content: 'tart and watery' }],
      output_config: { effort: 'low' },
    });
    expect(options).toEqual({ timeout: 30_000 });
  });

  it('reads no tags when none fit', async () => {
    const { reader } = setup(answered({ tags: [] }));
    expect(await reader.readTaste('nice cup', 'k')).toEqual({ ok: true, value: [] });
  });

  it('sends pasted text as text, and a PDF as a base64 document', async () => {
    const { reader, parse } = setup(answered(SHEET));
    expect(await reader.readSpecSheet({ kind: 'text', text: 'Guji, natural' }, 'k')).toEqual({
      ok: true,
      value: SHEET,
    });
    await reader.readSpecSheet({ kind: 'pdf', bytes: new Uint8Array([37, 80, 68, 70]) }, 'k');
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
    expect(await reader.readTaste('words', 'k')).toEqual({
      ok: false,
      error: { kind: 'unreadable', provider: 'claude' },
    });
    expect(entries.map((e) => e.event)).toEqual(['ai.read-failed']);
  });

  it.each([
    ['no connection', new Anthropic.APIConnectionError({ message: 'down' }), 'offline'],
    ['a timeout', new Anthropic.APIConnectionTimeoutError(), 'offline'],
    ['a refused key', Object.assign(new Error('no'), { status: 401 }), 'key-refused'],
    ['no permission', Object.assign(new Error('no'), { status: 403 }), 'key-refused'],
    ['too many requests', Object.assign(new Error('slow'), { status: 429 }), 'rate-limited'],
    ['overloaded', Object.assign(new Error('busy'), { status: 529 }), 'rate-limited'],
    ['a bad request', Object.assign(new Error('bad'), { status: 400 }), 'failed'],
    ['anything else', new Error('boom'), 'failed'],
    ['a thrown string', 'boom', 'failed'],
  ])('maps %s to %s, logging the status but never the key or words', async (_n, error, kind) => {
    const { reader, entries } = setup(thrown(error));
    expect(await reader.readTaste('secret tasting words', 'sk-ant-secret')).toEqual({
      ok: false,
      error: { kind, provider: 'claude' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.context).toMatchObject({ provider: 'claude', kind });
    const logged = JSON.stringify(entries);
    expect(logged).not.toContain('sk-ant-secret');
    expect(logged).not.toContain('secret tasting words');
  });
});
