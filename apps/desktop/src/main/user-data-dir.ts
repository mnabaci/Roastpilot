import { isAbsolute } from 'node:path';

/** Development only: run the app on a throwaway data folder instead of the real one. */
export const USER_DATA_ENV = 'ROASTPILOT_USER_DATA';

export type UserDataChoice =
  | { kind: 'default' }
  | { kind: 'override'; dir: string }
  | { kind: 'ignored'; reason: 'packaged' | 'not-absolute'; value: string };

/**
 * Which data folder the app uses: the env var's folder in a development run, otherwise
 * Electron's default. A packaged app always keeps the real folder.
 */
export function chooseUserData(
  env: Readonly<Record<string, string | undefined>>,
  packaged: boolean,
): UserDataChoice {
  const value = env[USER_DATA_ENV]?.trim();
  if (!value) return { kind: 'default' };
  if (packaged) return { kind: 'ignored', reason: 'packaged', value };
  if (!isAbsolute(value)) return { kind: 'ignored', reason: 'not-absolute', value };
  return { kind: 'override', dir: value };
}
