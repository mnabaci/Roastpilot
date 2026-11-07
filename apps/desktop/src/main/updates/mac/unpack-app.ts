import { err, ok, type Result } from '@roastpilot/shared';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunCommand, StepFailure } from './run-command';

/** electron-builder.yml `appId`: the app inside the zip must be this one. */
export const BUNDLE_ID = 'app.roastpilot.desktop';

/** One key of the app's Info.plist, as plain text. */
async function plistValue(
  run: RunCommand,
  app: string,
  key: string,
): Promise<Result<string, StepFailure>> {
  const read = await run('/usr/bin/plutil', [
    '-extract',
    key,
    'raw',
    '-o',
    '-',
    join(app, 'Contents', 'Info.plist'),
  ]);
  return read.ok ? ok(read.value.trim()) : read;
}

/**
 * Unpacks the zip into `dir` with `ditto` (it keeps the signature) and checks the app inside before
 * it counts as ready: exactly one `.app`, its signature holds (`codesign --verify --deep
 * --strict`), it is Roastpilot, and it is `version`. Answers the app's path.
 */
export async function unpackApp(
  zipFile: string,
  dir: string,
  version: string,
  run: RunCommand,
): Promise<Result<string, StepFailure>> {
  await mkdir(dir, { recursive: true });
  const unpacked = await run('/usr/bin/ditto', ['-x', '-k', zipFile, dir]);
  if (!unpacked.ok) return unpacked;
  const apps = (await readdir(dir)).filter((name) => name.endsWith('.app'));
  const [name] = apps;
  if (name === undefined || apps.length > 1)
    return err({ message: `The zip holds ${String(apps.length)} apps, not one` });
  const app = join(dir, name);
  const signed = await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  if (!signed.ok) return signed;
  const id = await plistValue(run, app, 'CFBundleIdentifier');
  if (!id.ok) return id;
  if (id.value !== BUNDLE_ID) return err({ message: `The zip holds ${id.value}, not Roastpilot` });
  const shown = await plistValue(run, app, 'CFBundleShortVersionString');
  if (!shown.ok) return shown;
  if (shown.value !== version)
    return err({ message: `The zip holds version ${shown.value}, not ${version}` });
  return ok(app);
}
