import { describe, expect, it } from 'vitest';
import { pdfPageCount } from './sheet-pdf';

/** A PDF of `pages` pages, as far as the page count reads it. */
const pdf = (pages: number) =>
  new Uint8Array(Buffer.from(`%PDF-1.7\n${'<< /Type /Page >>\n'.repeat(pages)}%%EOF`));

describe('pdfPageCount', () => {
  it('reads the page tree’s count, the largest when a saved change repeats it', () => {
    const tree = (count: number) => `<< /Type /Pages /Kids [3 0 R] /Count ${String(count)} >>`;
    const bytes = (text: string) => new Uint8Array(Buffer.from(`%PDF-1.7\n${text}`));
    expect(pdfPageCount(bytes(`${tree(15)}\n${'<< /Type /Page >>\n'.repeat(30)}`))).toBe(15);
    expect(pdfPageCount(bytes(`${tree(12)}\n${tree(15)}`))).toBe(15);
  });

  it('counts page objects when there is no page tree in plain sight', () => {
    expect(pdfPageCount(pdf(3))).toBe(3);
    expect(pdfPageCount(new Uint8Array(Buffer.from('/Type/Page /Type /Page/Contents')))).toBe(2);
    expect(pdfPageCount(new Uint8Array(Buffer.from('%PDF-1.7 compressed')))).toBe(0);
  });
});
