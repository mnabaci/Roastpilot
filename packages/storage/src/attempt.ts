import { err, ok, type Result, type StorageError } from '@roastpilot/shared';

/** Runs a query and turns anything it throws into a typed error. */
export async function attempt<T>(work: () => Promise<T>): Promise<Result<T, StorageError>> {
  try {
    return ok(await work());
  } catch (error) {
    return err({
      kind: 'storage-failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Parsed JSON, or undefined when the text isn't JSON (the schema check then rejects the row). */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
