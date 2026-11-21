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
import { SPEC_SHEET_INSTRUCTION, TASTE_INSTRUCTION } from './taste-words';

/** The model both reads use (docs/spec/ai-helpers.md, Reading). */
export const CLAUDE_MODEL = 'claude-opus-5-5';
/** A read gives up after this long (each attempt; the SDK retries twice). */
export const AI_TIMEOUT_MS = 30_000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const TasteAnswerSchema = z.object({ tags: z.array(TasteTagSchema) });

/** The one SDK call the reader makes, so tests can stand in for it. */
export type ClaudeParse = Anthropic['beta']['messages']['parse'];

const isConnection = (error: unknown): boolean => error instanceof Anthropic.APIConnectionError;

/**
 * Claude reads tasting words and spec sheets with the roaster's own key: structured output against
 * the result's schema, low effort, server-side refusal fallback on.
 */
export class ClaudeReader implements TasteReader, SpecSheetReader {
  readonly provider = 'claude' as const;
  readonly #parseWith: (key: string) => ClaudeParse;
  readonly #logger: Logger;

  /** `parseWith` builds the SDK call for a key; the default is the real client. */
  constructor(logger: Logger, parseWith: (key: string) => ClaudeParse = realParse) {
    this.#logger = logger;
    this.#parseWith = parseWith;
  }

  async readTaste(words: string, key: string): Promise<Result<TasteTag[], AiReadError>> {
    const read = await this.#read(key, TASTE_INSTRUCTION, words, TasteAnswerSchema, 1_024);
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
    return this.#read(key, SPEC_SHEET_INSTRUCTION, content, RawSpecSheetSchema, 4_096);
  }

  async #read<T>(
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
        { timeout: AI_TIMEOUT_MS },
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
        provider: this.provider,
        kind: 'unreadable',
        stopReason: message.stop_reason,
      });
      return err({ kind: 'unreadable', provider: this.provider });
    } catch (error) {
      const failed = readErrorOf(this.provider, error, isConnection);
      this.#logger.warn('ai.read-failed', {
        provider: this.provider,
        kind: failed.kind,
        status: statusOf(error),
      });
      return err(failed);
    }
  }
}

function realParse(key: string): ClaudeParse {
  const client = new Anthropic({ apiKey: key });
  return client.beta.messages.parse.bind(client.beta.messages);
}
