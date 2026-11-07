import { serializeError, type Logger } from '@roastpilot/core';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** The helper's log, in `<userData>/updates/`. */
export const INSTALL_LOG = 'install.log';

/** How the last swap went, from the helper's `result:` line. */
export type LastInstall =
  { ok: true; version: string | null } | { ok: false; version: string | null; reason: string };

/**
 * The last `result: ok` or `result: failed <reason>` line of the helper's log, and the version from
 * its `staged:` line (`…/updates/0.2.0/Roastpilot.app`). Undefined when it never got that far.
 */
export function parseInstallLog(text: string): LastInstall | undefined {
  const lines = text.split('\n');
  const staged = lines.findLast((line) => line.includes(' staged: '));
  const version = /\/(\d+\.\d+\.\d+)\/[^/]+\.app$/.exec(staged ?? '')?.[1] ?? null;
  const result = lines.findLast((line) => / result: (ok|failed)\b/.test(line));
  if (result === undefined) return undefined;
  const failed = / result: failed ?(.*)$/.exec(result);
  if (failed === null) return { ok: true, version };
  const reason = failed[1]?.trim() ?? '';
  return { ok: false, version, reason: reason === '' ? 'unknown' : reason };
}

const missing = (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/**
 * Reads how the last install went and deletes the log, so it is reported once. A missing log is
 * the usual case (nothing installed); an unreadable one is logged and ignored.
 */
export async function takeLastInstall(
  dir: string,
  logger: Logger,
): Promise<LastInstall | undefined> {
  const file = join(dir, INSTALL_LOG);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (!missing(error))
      logger.warn('update.install-log-unreadable', { error: serializeError(error) });
    return undefined;
  }
  await rm(file, { force: true });
  const last = parseInstallLog(text);
  if (last?.ok === true) logger.info('update.installed', { version: last.version });
  if (last?.ok === false)
    logger.warn('update.install-log', { log: text.trim().split('\n').slice(-20) });
  return last;
}

/** Deletes everything but the helper's log: a download cut off, or an app staged and not installed. */
export async function clearUpdates(dir: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (missing(error)) return;
    throw error;
  }
  for (const name of names)
    if (name !== INSTALL_LOG) await rm(join(dir, name), { recursive: true, force: true });
}
