import { createLogger } from '@roastpilot/core';
import { err, type LogEntry } from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import { pageText, readOrderPage } from './order-page';

const SHOP = `<!doctype html><html><head>
  <title>Kiambu AA &ndash; Green Coffee Collective</title>
  <meta property="og:description" content="Washed SL28 &amp; SL34 from Kiambu, 1,800 m">
  <script>window.cart = {}</script>
  <script type="application/ld+json">{"@type":"Product","name":"Kiambu AA"}</script>
</head><body>
  <header><nav><a href="/">Home</a><a href="/coffee">Coffee</a></nav></header>
  <main><h1>Kiambu AA</h1><p>Origin: Kenya</p><p>Process: Washed</p><ul><li>Blackcurrant</li><li>Grapefruit</li></ul></main>
  <footer>© Shop · Privacy</footer>
  <style>.a{color:red}</style>
</body></html>`;

function logger() {
  const entries: LogEntry[] = [];
  return { entries, log: createLogger({ write: (e) => entries.push(e) }, 'ai') };
}

describe('pageText', () => {
  it("keeps the page's title, description, product data and words, not its scripts or menus", () => {
    const text = pageText(SHOP);
    expect(text).toContain('Title: Kiambu AA – Green Coffee Collective');
    expect(text).toContain('Description: Washed SL28 & SL34 from Kiambu, 1,800 m');
    expect(text).toContain('{"@type":"Product","name":"Kiambu AA"}');
    expect(text).toContain('Origin: Kenya\nProcess: Washed\nBlackcurrant\nGrapefruit');
    expect(text).not.toMatch(/window\.cart|Home|Privacy|color:red/);
  });
});

describe('readOrderPage', () => {
  it('reads an HTML page and logs its site and size, not what it says', async () => {
    const { entries, log } = logger();
    const fetchPage = vi.fn(() =>
      Promise.resolve(
        new Response(SHOP.replace('Origin: Kenya', `Origin: Kenya ${'notes '.repeat(40)}`), {
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );
    const read = await readOrderPage('https://shop.example/kiambu', fetchPage, log);
    expect(read.ok && read.value).toContain('Origin: Kenya');
    expect(fetchPage).toHaveBeenCalledWith('https://shop.example/kiambu', {
      signal: expect.any(AbortSignal) as AbortSignal,
    });
    expect(entries.at(-1)).toMatchObject({
      event: 'ai.page-read',
      context: { site: 'shop.example' },
    });
    expect(JSON.stringify(entries)).not.toContain('Kenya');
  });

  it('says unreachable for a missing page, one that is not a web page, or no answer', async () => {
    const { log } = logger();
    const answers = [
      new Response('gone', { status: 404, headers: { 'content-type': 'text/html' } }),
      new Response('%PDF-', { headers: { 'content-type': 'application/pdf' } }),
    ];
    for (const answer of answers) {
      expect(
        await readOrderPage('https://shop.example/x', () => Promise.resolve(answer), log),
      ).toEqual(err({ kind: 'page-unreachable' }));
    }
    expect(
      await readOrderPage(
        'https://shop.example/x',
        () => Promise.reject(new Error('timeout')),
        log,
      ),
    ).toEqual(err({ kind: 'page-unreachable' }));
  });

  it('says empty for a page built by script', async () => {
    const { log } = logger();
    const app = new Response(
      '<html><body><div id="root"></div><script>render()</script></body></html>',
      {
        headers: { 'content-type': 'text/html' },
      },
    );
    expect(await readOrderPage('https://shop.example/x', () => Promise.resolve(app), log)).toEqual(
      err({ kind: 'page-empty' }),
    );
  });
});
