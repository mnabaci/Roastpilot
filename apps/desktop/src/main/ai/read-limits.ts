// How long a read may take, the same for every provider (docs/spec/ai-helpers.md, Reading).

/** Each try gives up after this long, and a failed try is retried once: about 30 s in all. */
export const AI_TRY_TIMEOUT_MS = 15_000;
export const AI_RETRIES = 1;
/** A read stops here whatever the SDK's retries or a server's retry-after asks: one hard stop. */
export const AI_READ_LIMIT_MS = 30_000;
