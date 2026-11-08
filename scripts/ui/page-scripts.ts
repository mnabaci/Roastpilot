// Expressions run inside the Roastpilot window. Each is self-contained (no imports reach the
// page) and resolves to a JSON value the CLI prints.

const SETTLE_MS = 400;

/** Clicks each label in turn: the first button, radio, label or link whose text is exactly it. */
export function clickByText(labels: readonly string[]): string {
  return `(async (labels) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const label of labels) {
    const el = [...document.querySelectorAll('button,[role=radio],[role=tab],[role=option],[role=menuitem],label,a')]
      .find((e) => e.textContent.trim() === label);
    if (!el) return { ok: false, missing: label };
    el.click();
    await sleep(${SETTLE_MS});
  }
  return { ok: true, theme: document.documentElement.dataset.theme ?? null };
})(${JSON.stringify(labels)})`;
}

/**
 * Scrolls to the end: the scroller around the heading with exactly this text, or every scroller
 * on the page without one.
 */
export function scrollToEnd(heading?: string): string {
  return `(async (heading) => {
  const scrolls = (e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY);
  let targets;
  if (heading) {
    const h = [...document.querySelectorAll('h1,h2,h3')].find((e) => e.textContent.trim() === heading);
    if (!h) return { ok: false, missing: heading };
    let el = h.parentElement;
    while (el && !scrolls(el)) el = el.parentElement;
    if (!el) return { ok: false, noScroller: heading };
    targets = [el];
  } else {
    targets = [...document.querySelectorAll('*')].filter(scrolls);
  }
  for (const el of targets) el.scrollTop = el.scrollHeight;
  await new Promise((r) => setTimeout(r, ${SETTLE_MS}));
  return { ok: true, scrolled: targets.length };
})(${JSON.stringify(heading ?? null)})`;
}

/**
 * The page-level overflow checks from the design review (both must be true), plus every inner
 * scroller with its scroll and client height.
 */
export const measureOverflow = `(() => {
  const d = document.documentElement;
  const scrollers = [...document.querySelectorAll('*')]
    .filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY))
    .map((e) => (e.getAttribute('aria-label') ?? e.tagName.toLowerCase()) + ' ' + e.scrollHeight + '/' + e.clientHeight);
  return {
    viewport: d.clientWidth + 'x' + d.clientHeight,
    noSideScroll: d.scrollWidth === d.clientWidth,
    noPageScroll: d.scrollHeight === d.clientHeight,
    scrollers,
  };
})()`;
