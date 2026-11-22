import type { Logger, TasteReader } from '@roastpilot/core';
import {
  err,
  ok,
  TASTE_TAGS,
  type AiReadError,
  type Result,
  type TasteTag,
} from '@roastpilot/shared';
import {
  APIConnectionError,
  APIUserAbortError,
  NotFoundError,
  noul,
  TypeSafeClient,
  type NoulQuestion,
} from '@typesafe-ai/sdk';
import { readErrorOf, statusOf } from './ai-errors';
import { askChain, type ModelChain } from './ai-model';
import type { AiProvider } from './ai-provider';
import { AI_READ_LIMIT_MS, AI_RETRIES, AI_TRY_TIMEOUT_MS } from './read-limits';
import { TASTE_MEANINGS } from './taste-words';

/** What Jev says about itself in Settings: the one place these facts are written. */
const JEV_INFO = {
  id: 'jev',
  label: 'Jev',
  company: 'TypeSafe',
  keyFrom: 'console.typesafe.ai',
} as const;

/**
 * The models Jev reads with, first to last (docs/spec/ai-helpers.md, Models). One for now: a
 * newer one goes in front when TypeSafe releases it, never `jev-latest`, which changes unseen.
 */
export const JEV_MODELS: ModelChain = [{ id: 'jev-1.14.0', label: 'Jev 1.14' }];
/** A tag is ticked at this probability or more: a starting guess to revisit. */
export const JEV_TICK_AT = 0.6;

/** One Noul question per tag, in the tags' order. */
const QUESTIONS: Readonly<Record<TasteTag, NoulQuestion>> = Object.fromEntries(
  TASTE_TAGS.map((tag) => [
    tag,
    noul('Do these tasting notes describe this?', {
      true: TASTE_MEANINGS[tag].yes,
      false: TASTE_MEANINGS[tag].no,
    }),
  ]),
) as Record<TasteTag, NoulQuestion>;

/** What Jev answers each question: the probability of yes. */
type NoulAnswers = Readonly<Record<string, { noul: number } | undefined>>;

/** The one SDK call the reader makes, so tests can stand in for it. */
export type JevAsk = (request: {
  model: string;
  state: string;
  questions: Record<TasteTag, NoulQuestion>;
  signal: AbortSignal;
}) => Promise<NoulAnswers>;

/** TypeSafe's own host, so no environment variable can send the key elsewhere. */
const JEV_HOST = 'https://api.typesafe.ai';

/** No connection, a try that timed out, or the hard stop: Jev couldn't be reached in time. */
const isConnection = (error: unknown): boolean =>
  error instanceof APIConnectionError || error instanceof APIUserAbortError;

/** TypeSafe's "no such model": retired, or not on the key's account. The host is pinned. */
const isGone = (error: unknown): boolean => error instanceof NotFoundError;

/** Jev reads tasting words: each tag one yes/no question, all asked at once. */
export class JevTasteReader implements TasteReader {
  readonly provider = JEV_INFO.id;
  readonly modelName: string;
  readonly #models: ModelChain;
  readonly #askWith: (key: string) => JevAsk;
  readonly #logger: Logger;

  /** `askWith` builds the SDK call for a key; the default is the real client. */
  constructor(logger: Logger, models: ModelChain, askWith: (key: string) => JevAsk = realAsk) {
    this.#logger = logger;
    this.#models = models;
    this.modelName = models[0].label;
    this.#askWith = askWith;
  }

  async readTaste(words: string, key: string): Promise<Result<TasteTag[], AiReadError>> {
    const ask = this.#askWith(key);
    // One hard stop for the whole read, however many models it asks.
    const signal = AbortSignal.timeout(AI_READ_LIMIT_MS);
    try {
      const chain = await askChain({
        chain: this.#models,
        isGone,
        logger: this.#logger,
        context: { helper: 'taste', provider: this.provider },
        ask: (model) => ask({ model: model.id, state: words, questions: QUESTIONS, signal }),
      });
      if (!chain.answered) return this.#failed('model-retired');
      const answers = chain.value;
      const read = TASTE_TAGS.map((tag) => answers[tag]?.noul);
      // Every answer a probability, or nothing is trusted.
      if (!read.every((p) => typeof p === 'number' && p >= 0 && p <= 1))
        return this.#failed('unreadable');
      return ok(TASTE_TAGS.filter((_tag, i) => (read[i] ?? 0) >= JEV_TICK_AT));
    } catch (error) {
      const failed = readErrorOf(this.provider, error, isConnection);
      this.#logger.warn('ai.read-failed', {
        helper: 'taste',
        provider: this.provider,
        kind: failed.kind,
        status: statusOf(error),
      });
      return err(failed);
    }
  }

  #failed(kind: 'unreadable' | 'model-retired'): Result<never, AiReadError> {
    this.#logger.warn('ai.read-failed', { helper: 'taste', provider: this.provider, kind });
    return err({ kind, provider: this.provider });
  }
}

function realAsk(key: string): JevAsk {
  // No console from the SDK (the app logs through its Logger), and no key from the environment.
  const client = new TypeSafeClient({
    apiKey: key,
    baseURL: JEV_HOST,
    logLevel: 'off',
    timeout: AI_TRY_TIMEOUT_MS,
    retry: { maxRetries: AI_RETRIES },
  });
  return async ({ model, state, questions, signal }) => {
    const { answers } = await client.systemOne({ model, state, questions }, { signal });
    return answers;
  };
}

/**
 * Jev as main registers it: it reads tasting words only, as it answers yes/no and pick-one
 * questions and can't pull numbers and names off a spec sheet.
 */
export function jevProvider(logger: Logger): AiProvider {
  return { info: JEV_INFO, taste: new JevTasteReader(logger, JEV_MODELS) };
}
