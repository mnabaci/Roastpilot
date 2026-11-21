import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
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
import { readErrorOf, statusOf } from './ai-errors';
import type { AiProvider } from './ai-provider';
import { SPEC_SHEET_INSTRUCTION, TASTE_INSTRUCTION } from './taste-words';

/** What Claude says about itself in Settings: the one place these facts are written. */
const CLAUDE_INFO = {
  id: 'claude',
  label: 'Claude',
  company: 'Anthropic',
  keyFrom: 'console.anthropic.com',
} as const;

/** The model both reads use (docs/spec/ai-helpers.md, Reading). */
export const CLAUDE_MODEL = 'claude-opus-5-5';
/** Each try gives up after this long, and a failed try is retried once: about 30 s in all. */
export const AI_TRY_TIMEOUT_MS = 15_000;
export const AI_RETRIES = 1;
/** A read stops here whatever the SDK's retries or a server's retry-after asks: one hard stop. */
export const AI_READ_LIMIT_MS = 30_000;
/** Each provider's own host, so no environment variable can send a key elsewhere. */
const CLAUDE_HOST = 'https://api.anthropic.com';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const TasteAnswerSchema = z.object({ tags: z.array(TasteTagSchema) });

/** The one SDK call the reader makes, so tests can stand in for it. */
export type ClaudeParse = Anthropic['beta']['messages']['parse'];

/** No connection, a try that timed out, or the hard stop: the AI couldn't be reached in time. */
const isConnection = (error: unknown): boolean =>
  error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.APIUserAbortError;

/** The SDK's own error with no HTTP status and no connection behind it: the answer didn't parse. */
const isUnparsed = (error: unknown): boolean =>
  error instanceof Anthropic.AnthropicError &&
  !(error instanceof Anthropic.APIError) &&
  !(error instanceof Anthropic.APIConnectionError);

/**
 * Claude reads tasting words and spec sheets with the roaster's own key: structured output against
 * the result's schema, low effort, server-side refusal fallback on.
 */
export class ClaudeReader implements TasteReader, SpecSheetReader {
  readonly provider = CLAUDE_INFO.id;
  readonly #parseWith: (key: string) => ClaudeParse;
  readonly #logger: Logger;

  /** `parseWith` builds the SDK call for a key; the default is the real client. */
  constructor(logger: Logger, parseWith: (key: string) => ClaudeParse = realParse) {
    this.#logger = logger;
    this.#parseWith = parseWith;
  }

  async readTaste(words: string, key: string): Promise<Result<TasteTag[], AiReadError>> {
    const read = await this.#read('taste', key, TASTE_INSTRUCTION, words, TasteAnswerSchema, 1_024);
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
    return this.#read(
      'spec-sheet',
      key,
      SPEC_SHEET_INSTRUCTION,
      content,
      RawSpecSheetSchema,
      4_096,
    );
  }

  async #read<T>(
    helper: 'taste' | 'spec-sheet',
    key: string,
    instruction: string,
    content: string | Anthropic.Beta.BetaContentBlockParam[],
    schema: z.ZodType<T>,
    maxTokens: number,
  ): Promise<Result<T, AiReadError>> {
    try {
      const message = await this.#parseWith(key)(
        {
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          system: instruction,
          messages: [{ role: 'user', content }],
          output_config: { effort: 'low', format: betaZodOutputFormat(schema) },
        },
        { timeout: AI_TRY_TIMEOUT_MS, signal: AbortSignal.timeout(AI_READ_LIMIT_MS) },
      );
      // A refusal, or an answer cut short, may not fit the schema: nothing to use.
      const checked = schema.safeParse(message.parsed_output);
      if (
        message.stop_reason !== 'refusal' &&
        message.stop_reason !== 'max_tokens' &&
        checked.success
      )
        return ok(checked.data);
      this.#logger.warn('ai.read-failed', {
        helper,
        provider: this.provider,
        kind: 'unreadable',
        stopReason: message.stop_reason,
      });
      return err({ kind: 'unreadable', provider: this.provider });
    } catch (error) {
      // The SDK throws when an answer doesn't parse into the schema: a refusal's words, or an
      // answer cut short. That is unreadable, not a failure to answer.
      const failed = isUnparsed(error)
        ? { kind: 'unreadable' as const, provider: this.provider }
        : readErrorOf(this.provider, error, isConnection);
      this.#logger.warn('ai.read-failed', {
        helper,
        provider: this.provider,
        kind: failed.kind,
        status: statusOf(error),
      });
      return err(failed);
    }
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

/** Claude as main registers it: it reads tasting words and spec sheets. */
export function claudeProvider(logger: Logger): AiProvider {
  const reader = new ClaudeReader(logger);
  return { info: CLAUDE_INFO, taste: reader, specSheet: reader };
}
