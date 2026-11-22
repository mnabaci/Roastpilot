import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { AiModel, ModelChain } from './ai-model';

/** A Claude model, and whether it takes the server-side refusal fallback (Haiku doesn't). */
export interface ClaudeModel extends AiModel {
  refusalFallback: boolean;
}

const HAIKU: ClaudeModel = { id: 'claude-haiku-5-5', label: 'Haiku 5.5', refusalFallback: false };
const SONNET: ClaudeModel = { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', refusalFallback: true };
const OPUS: ClaudeModel = { id: 'claude-opus-5-5', label: 'Opus 5.5', refusalFallback: true };

/**
 * Each job's models, first to last (docs/spec/ai-helpers.md, Models): tags from a few words are
 * light work for Haiku; a sheet, often a PDF, is read by Opus. Sonnet stands in for either.
 */
export const CLAUDE_MODELS = {
  taste: [HAIKU, SONNET],
  specSheet: [OPUS, SONNET],
} as const satisfies Record<'taste' | 'specSheet', ModelChain<ClaudeModel>>;

/** The server-side refusal fallback: a refused read is re-run on the fallback the API picks. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** What one read asks one model. */
export interface ClaudeAsk<T> {
  model: ClaudeModel;
  instruction: string;
  content: string | Anthropic.Beta.BetaContentBlockParam[];
  schema: z.ZodType<T>;
  maxTokens: number;
}

/** The request for one model: low effort, structured output, the refusal fallback where it takes it. */
export function requestFor<T>({ model, instruction, content, schema, maxTokens }: ClaudeAsk<T>) {
  return {
    model: model.id,
    max_tokens: maxTokens,
    ...(model.refusalFallback ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
    system: instruction,
    messages: [{ role: 'user' as const, content }],
    output_config: { effort: 'low' as const, format: betaZodOutputFormat(schema) },
  };
}
