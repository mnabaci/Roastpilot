import { err, ok, type Result } from '@roastpilot/shared';
import { serializeError, type Logger } from '@roastpilot/core';

/** Roastpilot files are far smaller; anything bigger isn't one, and would fill memory. */
export const MAX_PICKED_BYTES = 50 * 1024 * 1024;

/** Reading and writing the file you picked, the file system injected. */
export interface PickedFileDeps {
  readText: (path: string) => Promise<string>;
  writeText: (path: string, text: string) => Promise<void>;
  /** The file's size in bytes. */
  sizeOf: (path: string) => Promise<number>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  logger: Logger;
}

/** The picked file's text, or why it couldn't be read (logged as `event`). Too big isn't read. */
export async function readPicked(
  path: string,
  { readText, sizeOf, logger }: Pick<PickedFileDeps, 'readText' | 'sizeOf' | 'logger'>,
  event: string,
): Promise<Result<string, { kind: 'read-failed' } | { kind: 'too-big' }>> {
  try {
    const bytes = await sizeOf(path);
    if (bytes > MAX_PICKED_BYTES) {
      logger.warn(event, { reason: 'too-big', bytes });
      return err({ kind: 'too-big' });
    }
    return ok(await readText(path));
  } catch (error) {
    logger.warn(event, { error: serializeError(error) });
    return err({ kind: 'read-failed' });
  }
}

/**
 * Writes `text` where you picked, or says it couldn't (logged as `event`). It goes to a temporary
 * file beside it first, then takes its place, so a failed write never leaves half a file there.
 */
export async function writePicked(
  path: string,
  text: string,
  {
    writeText,
    rename,
    remove,
    logger,
  }: Pick<PickedFileDeps, 'writeText' | 'rename' | 'remove' | 'logger'>,
  event: string,
): Promise<Result<void, { kind: 'write-failed' }>> {
  const temporary = `${path}.tmp`;
  try {
    await writeText(temporary, text);
    await rename(temporary, path);
    return ok(undefined);
  } catch (error) {
    logger.warn(event, { error: serializeError(error) });
    await remove(temporary).catch((removeError: unknown) => {
      logger.warn('files.temp-not-removed', {
        path: temporary,
        error: serializeError(removeError),
      });
    });
    return err({ kind: 'write-failed' });
  }
}
