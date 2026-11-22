import { serializeError, type Logger } from '@roastpilot/core';
import { err, ok, SPEC_SHEET_TEXT_MAX, type AiReadError, type Result } from '@roastpilot/shared';

/** Fetching a page: Electron's `net.fetch` in the app, so a shop sees a browser; a fake in tests. */
export type FetchPage = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

/** A page gives up after this long: the read that follows has its own limit. */
export const PAGE_FETCH_LIMIT_MS = 15_000;
/** More than this isn't a product page; what's read stops here. */
const PAGE_MAX_BYTES = 3_000_000;
/** Less text than this is a page built by script, or an error page: nothing worth sending. */
const PAGE_MIN_TEXT = 200;

/** The body, cut at `limit` bytes: a page that keeps sending is never read whole. */
async function bodyText(response: Response, limit: number): Promise<string> {
  const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= limit) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks).subarray(0, limit).toString('utf8');
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  deg: '°',
};

/** The few entities a product page uses, and every numeric one. */
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** A meta tag's content, by its name or property ("description", "og:description"). */
function meta(html: string, name: string): string {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() === name) {
      return decode(/\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '').trim();
    }
  }
  return '';
}

/**
 * What a shop's product page says, as text for the spec-sheet reader: its title and description,
 * its product data (JSON-LD), then the page's own words, without scripts, styles, menus and footer.
 */
export function pageText(html: string): string {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').trim();
  const description = meta(html, 'og:description') || meta(html, 'description');
  const data = [
    ...html.matchAll(
      /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .map(([, json]) => (json ?? '').trim())
    .filter((json) => json.includes('"Product"'))
    .join('\n')
    .slice(0, 4000);
  const body = decode(
    html
      .replace(/<head[\s\S]*?<\/head>/i, ' ')
      .replace(
        /<(script|style|noscript|svg|template|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi,
        ' ',
      )
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/dt|\/dd|\/section|\/article)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line, i, lines) => line !== '' && line !== lines[i - 1])
    .join('\n');
  return [title && `Title: ${title}`, description && `Description: ${description}`, data, body]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, SPEC_SHEET_TEXT_MAX);
}

/**
 * A bean's order page as text to read like a spec sheet (docs/spec/beans-favourites-ghost.md,
 * Fill details). Logs the page's site and size, never what it says.
 */
export async function readOrderPage(
  url: string,
  fetchPage: FetchPage,
  logger: Logger,
): Promise<Result<string, AiReadError>> {
  const site = new URL(url).hostname;
  try {
    const response = await fetchPage(url, { signal: AbortSignal.timeout(PAGE_FETCH_LIMIT_MS) });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !/html|text\/plain/i.test(type)) {
      logger.warn('ai.page-unreachable', { site, status: response.status, type });
      return err({ kind: 'page-unreachable' });
    }
    const raw = await bodyText(response, PAGE_MAX_BYTES);
    const text = /html/i.test(type) ? pageText(raw) : raw.slice(0, SPEC_SHEET_TEXT_MAX);
    logger.info('ai.page-read', { site, bytes: raw.length, chars: text.length });
    if (text.length < PAGE_MIN_TEXT) return err({ kind: 'page-empty' });
    return ok(text);
  } catch (error) {
    logger.warn('ai.page-unreachable', { site, error: serializeError(error) });
    return err({ kind: 'page-unreachable' });
  }
}
