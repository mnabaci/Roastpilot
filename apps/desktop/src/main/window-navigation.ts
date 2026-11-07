/**
 * Whether the window may go to `url`: only to the dev server's own origin in development, and
 * nowhere in a packaged build (its pages load from files and never navigate). Compared by origin,
 * so `http://localhost:5173.evil.example` or `http://localhost:51730` can't pass for
 * `http://localhost:5173`.
 */
export function isAppNavigation(url: string, devUrl: string | undefined): boolean {
  if (!devUrl) return false;
  try {
    return new URL(url).origin === new URL(devUrl).origin;
  } catch {
    // Not a URL at all: never ours.
    return false;
  }
}
