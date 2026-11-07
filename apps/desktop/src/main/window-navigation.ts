import { pathToFileURL } from 'node:url';

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

/** Where the app's page comes from: the dev server in development, else the packaged file. */
export interface AppPage {
  devUrl: string | undefined;
  /** Absolute path of the packaged `index.html`. */
  indexFile: string;
}

/**
 * Whether `url` is the app's own page: the dev server's origin in development, the packaged
 * `index.html` in a build (any `#route` or `?query` on it). Anything else, a `file://` next to it
 * included, is not.
 */
export function isAppPage(url: string, { devUrl, indexFile }: AppPage): boolean {
  if (devUrl) return isAppNavigation(url, devUrl);
  try {
    const page = new URL(url);
    page.hash = '';
    page.search = '';
    return page.href === pathToFileURL(indexFile).href;
  } catch {
    // Not a URL at all: never ours.
    return false;
  }
}
