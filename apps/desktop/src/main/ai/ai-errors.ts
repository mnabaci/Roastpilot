import type { AiProviderId, AiReadError } from '@roastpilot/shared';

/**
 * One read error kind for whatever a provider's SDK threw (docs/spec/ai-helpers.md, When it
 * fails). `isConnection` is the SDK's own test (its connection and timeout error classes); the
 * HTTP status says the rest, the same in both SDKs.
 */
export function readErrorOf(
  provider: AiProviderId,
  error: unknown,
  isConnection: (error: unknown) => boolean,
): AiReadError {
  if (isConnection(error)) return { kind: 'offline', provider };
  const status = statusOf(error);
  if (status === 401 || status === 403) return { kind: 'key-refused', provider };
  if (status === 429 || status === 529) return { kind: 'rate-limited', provider };
  return { kind: 'failed', provider };
}

/** The HTTP status of an SDK error, for the mapping and the log; undefined for anything else. */
export function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  return typeof error.status === 'number' ? error.status : undefined;
}
