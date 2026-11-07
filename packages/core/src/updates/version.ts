const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;
/** The installed version may carry a pre-release tag (`0.2.0-dev`); its numbers still count. */
const INSTALLED = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

function numbers(match: RegExpExecArray | null): number[] | undefined {
  return match ? match.slice(1, 4).map(Number) : undefined;
}

/**
 * Whether `candidate` is a release newer than `installed`. Pre-releases and anything that isn't
 * `X.Y.Z` are never newer: no pre-releases, no downgrades (docs/spec/install-and-update.md).
 */
export function isNewerVersion(candidate: string, installed: string): boolean {
  const next = numbers(RELEASE.exec(candidate));
  const now = numbers(INSTALLED.exec(installed));
  if (!next || !now) return false;
  for (let i = 0; i < 3; i++) {
    const a = next[i] ?? 0;
    const b = now[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}
