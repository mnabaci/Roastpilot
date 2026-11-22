import Anthropic from '@anthropic-ai/sdk';
import type { Logger, SpecSheetReader, SpecSheetSource, TasteReader } from '@roastpilot/core';
import {
  err,
  ok,
  orderedTags,
  RawSpecSheetSchema,
  TasteTagSchema,
  type AiReadError,
  type RawSpecSheet,
  type Result,
  type TasteTag,
} from '@roastpilot/shared';
import { z } from 'zod';
import { readErrorOf, statusOf, type ProviderReadError } from './ai-errors';
import { askChain, type ModelChain } from './ai-model';
import { CLAUDE_MODELS, requestFor, type ClaudeAsk, type ClaudeModel } from './claude-models';
import { AI_READ_LIMIT_MS, AI_RETRIES, AI_TRY_TIMEOUT_MS } from './read-limits';
import type { AiProvider } from './ai-provider';
import { SPEC_SHEET_INSTRUCTION, TASTE_INSTRUCTION } from './taste-words';

/** What Claude says about itself in Settings: the one place these facts are written. */
const CLAUDE_INFO = {
  id: 'claude',
  label: 'Claude',
  company: 'Anthropic',
  keyFrom: 'console.anthropic.com',
} as const;

/** Each provider's own host, so no environment variable can send a key elsewhere. */
const CLAUDE_HOST = 'https://api.anthropic.com';
const TasteAnswerSchema = z.object({ tags: z.array(TasteTagSchema) });

/** The one SDK call the reader makes, so tests can stand in for it. */
export type ClaudeParse = Anthropic['beta']['messages']['parse'];

/** Stop reasons that leave nothing to use: a refusal, or an answer cut short. */
const STOPPED_SHORT = new Set(['refusal', 'max_tokens']);

/** No connection, a try that timed out, or the hard stop: the AI couldn't be reached in time. */
const isConnection = (error: unknown): boolean =>
  error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.APIUserAbortError;

/**
 * The API's "no such model": a retired model, or one the key's account can't use. The host is
 * pinned, so nothing else can be missing; the error's type is checked, never its wording.
 */
const isGone = (error: unknown): boolean =>
  error instanceof Anthropic.NotFoundError && error.type === 'not_found_error';

/** The SDK's own error with no HTTP status and no connection behind it: the answer didn't parse. */
const isUnparsed = (error: unknown): boolean =>
  error instanceof Anthropic.AnthropicError &&
  !(error instanceof Anthropic.APIError) &&
  !(error instanceof Anthropic.APIConnectionError);

/**
 * Claude reads tasting words and spec sheets with the roaster's own key: structured output against
 * the result's schema, low effort, server-side refusal fallback on where the model takes it. One
 * reader per job, each with its own models.
 */
export class ClaudeReader implements TasteReader, SpecSheetReader {
  readonly provider = CLAUDE_INFO.id;
  readonly modelName: string;
  readonly #models: ModelChain<ClaudeModel>;
  readonly #parseWith: (key: string) => ClaudeParse;
  readonly #logger: Logger;

  /** `parseWith` builds the SDK call for a key; the default is the real client. */
  constructor(
    logger: Logger,
    models: ModelChain<ClaudeModel>,
    parseWith: (key: string) => ClaudeParse = realParse,
  ) {
    this.#logger = logger;
    this.#models = models;
    this.modelName = models[0].label;
    this.#parseWith = parseWith;
  }

  async readTaste(words: string, key: string): Promise<Result<TasteTag[], AiReadError>> {
    // Room for a little thinking before the tags, as Haiku thinks when it needs to.
    const read = await this.#read('taste', key, {
      instruction: TASTE_INSTRUCTION,
      content: words,
      schema: TasteAnswerSchema,
      maxTokens: 2_048,
    });
    return read.ok ? ok(orderedTags(read.value.tags)) : read;
  }

  readSpecSheet(sheet: SpecSheetSource, key: string): Promise<Result<RawSpecSheet, AiReadError>> {
    const content: Anthropic.Beta.BetaContentBlockParam[] =
      sheet.kind === 'text'
        ? [{ type: 'text', text: sheet.text }]
        : [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: Buffer.from(sheet.bytes).toString('base64'),
              },
            },
          ];
    return this.#read('spec-sheet', key, {
      instruction: SPEC_SHEET_INSTRUCTION,
      content,
      schema: RawSpecSheetSchema,
      maxTokens: 8_192,
    });
  }

  async #read<T>(
    helper: 'taste' | 'spec-sheet',
    key: string,
    ask: Omit<ClaudeAsk<T>, 'model'>,
  ): Promise<Result<T, AiReadError>> {
    const parse = this.#parseWith(key);
    // One hard stop for the whole read, however many models it asks.
    const signal = AbortSignal.timeout(AI_READ_LIMIT_MS);
    try {
      const chain = await askChain({
        chain: this.#models,
        isGone,
        logger: this.#logger,
        context: { helper, provider: this.provider },
        ask: (model) =>
          parse(requestFor({ ...ask, model }), { timeout: AI_TRY_TIMEOUT_MS, signal }),
      });
      if (!chain.answered) return this.#failed(helper, 'model-retired');
      const message = chain.value;
      // A refusal, or an answer cut short, may not fit the schema: nothing to use.
      const checked = ask.schema.safeParse(message.parsed_output);
      if (STOPPED_SHORT.has(message.stop_reason ?? '') || !checked.success)
        return this.#failed(helper, 'unreadable', { stopReason: message.stop_reason });
      return ok(checked.data);
    } catch (error) {
      // The SDK throws when an answer doesn't parse into the schema: a refusal's words, or an
      // answer cut short. That is unreadable, not a failure to answer.
      const kind = isUnparsed(error)
        ? 'unreadable'
        : readErrorOf(this.provider, error, isConnection).kind;
      return this.#failed(helper, kind, { status: statusOf(error) });
    }
  }

  /** A read that failed, logged with why: never the key, the words or the sheet. */
  #failed(
    helper: 'taste' | 'spec-sheet',
    kind: ProviderReadError['kind'],
    context: Record<string, unknown> = {},
  ): Result<never, AiReadError> {
    this.#logger.warn('ai.read-failed', { helper, provider: this.provider, kind, ...context });
    return err({ kind, provider: this.provider });
  }
}

function realParse(key: string): ClaudeParse {
  // The app logs through its Logger: no console from the SDK, and no key from the environment.
  const client = new Anthropic({
    apiKey: key,
    baseURL: CLAUDE_HOST,
    logLevel: 'off',
    maxRetries: AI_RETRIES,
  });
  return client.beta.messages.parse.bind(client.beta.messages);
}

/** Claude as main registers it: it reads tasting words and spec sheets, each with its models. */
export function claudeProvider(logger: Logger): AiProvider {
  return {
    info: CLAUDE_INFO,
    taste: new ClaudeReader(logger, CLAUDE_MODELS.taste),
    specSheet: new ClaudeReader(logger, CLAUDE_MODELS.specSheet),
  };
}
