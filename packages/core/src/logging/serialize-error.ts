export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: unknown;
}

/** Turns anything thrown into plain data a log line can hold: an Error becomes a SerializedError, anything else passes through. */
export function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const serialized: SerializedError = { name: error.name, message: error.message };
  if (error.stack) serialized.stack = error.stack;
  if (error.cause !== undefined) serialized.cause = serializeError(error.cause);
  return serialized;
}
