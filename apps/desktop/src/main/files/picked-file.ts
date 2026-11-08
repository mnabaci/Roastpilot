import { err, ok, type Result } from '@roastpilot/shared';
import { serializeError, type Logger } from '@roastpilot/core';

/** Reading and writing the file you picked, the file system injected. */
export interface PickedFileDeps {
  readText: (path: string) => Promise<string>;
  writeText: (path: string, text: string) => Promise<void>;
  logger: Logger;
}

/** The picked file's text, or why it couldn't be read (logged as `event`). */
export async function readPicked(
  path: string,
  { readText, logger }: Pick<PickedFileDeps, 'readText' | 'logger'>,
  event: string,
): Promise<Result<string, { kind: 'read-failed' }>> {
  try {
    return ok(await readText(path));
  } catch (error) {
    logger.warn(event, { error: serializeError(error) });
    return err({ kind: 'read-failed' });
  }
}

/** Writes `text` where you picked, or says it couldn't (logged as `event`). */
export async function writePicked(
  path: string,
  text: string,
  { writeText, logger }: Pick<PickedFileDeps, 'writeText' | 'logger'>,
  event: string,
): Promise<Result<void, { kind: 'write-failed' }>> {
  try {
    await writeText(path, text);
    return ok(undefined);
  } catch (error) {
    logger.warn(event, { error: serializeError(error) });
    return err({ kind: 'write-failed' });
  }
}
