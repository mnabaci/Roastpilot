import type { Logger } from '@roastpilot/core';
import type { AiProviderId } from '@roastpilot/shared';

/** One model a reader can send to: the id the provider knows it by, and its name on screen. */
export interface AiModel {
  id: string;
  label: string;
}

/** A job's models, the one to use first, then the ones to try when it is gone. Never empty. */
export type ModelChain<M extends AiModel = AiModel> = readonly [M, ...M[]];

/** What a read in a chain came to: a model's answer, or every model gone. */
type ChainAnswer<T> = { answered: true; value: T } | { answered: false };

/**
 * Asks the first model of the chain, and the next while the provider says the one asked is gone
 * (docs/spec/ai-helpers.md, Models). A retired model, and one the key's account can't use, both
 * look gone, so nothing is remembered between reads: a new key may reach the first again. Any
 * other failure is thrown on, as the reader maps it.
 */
export async function askChain<M extends AiModel, T>({
  chain,
  isGone,
  ask,
  logger,
  context,
}: {
  chain: ModelChain<M>;
  /** The provider's own "no such model" answer, told from every other failure. */
  isGone: (error: unknown) => boolean;
  ask: (model: M) => Promise<T>;
  logger: Logger;
  context: { helper: 'taste' | 'spec-sheet'; provider: AiProviderId };
}): Promise<ChainAnswer<T>> {
  for (const model of chain) {
    try {
      return { answered: true, value: await ask(model) };
    } catch (error) {
      if (!isGone(error)) throw error;
      logger.warn('ai.model-gone', { ...context, model: model.id });
    }
  }
  return { answered: false };
}
