import { createLogger, type SpecSheetReader, type TasteReader } from '@roastpilot/core';
import {
  err,
  ok,
  type AiProvider,
  type AiSettings,
  type LogEntry,
  type RawSpecSheet,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DialogParent } from '../files/file-dialogs';
import { AiService, pdfPageCount, type SheetFiles } from './ai-service';

const PARENT = {} as DialogParent;

const EMPTY_SHEET: RawSpecSheet = {
  name: null,
  origin: null,
  process: null,
  species: null,
  variety: null,
  altitudeMinM: null,
  altitudeMaxM: null,
  densityGL: null,
  moisturePct: null,
  screen: null,
  decaf: null,
  supplier: null,
  tastingNotes: [],
};

/** A PDF of `pages` pages, as far as the page count reads it. */
const pdf = (pages: number) =>
  new Uint8Array(
    Buffer.from(`%PDF-1.7\n<< /Type /Pages >>\n${'<< /Type /Page >>\n'.repeat(pages)}%%EOF`),
  );

function tasteReader(provider: AiProvider): TasteReader {
  return { provider, readTaste: vi.fn(() => Promise.resolve(ok(['sour' as const]))) };
}

function setup({
  settings = { enabled: true, tasteProvider: 'claude' },
  keys = { claude: 'sk-claude', jev: 'ts-jev' },
  files = {},
}: {
  settings?: AiSettings;
  keys?: Partial<Record<AiProvider, string>>;
  files?: Partial<SheetFiles>;
} = {}) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const claude = tasteReader('claude');
  const jev = tasteReader('jev');
  const sheetReader: SpecSheetReader = {
    provider: 'claude',
    readSpecSheet: vi.fn(() =>
      Promise.resolve(ok({ ...EMPTY_SHEET, origin: 'Kenya', moisturePct: 400 })),
    ),
  };
  const sheetFiles: SheetFiles = {
    choosePdf: vi.fn(() => Promise.resolve('/sheets/kenya.pdf')),
    sizeOf: vi.fn(() => Promise.resolve(2_000)),
    readBytes: vi.fn(() => Promise.resolve(pdf(2))),
    ...files,
  };
  let clock = 0;
  const service = new AiService({
    settings: () => Promise.resolve(settings),
    keys: { read: (provider) => Promise.resolve(keys[provider]) },
    tasteReaders: { claude, jev },
    sheetReader,
    files: sheetFiles,
    logger,
    now: () => (clock += 250),
  });
  return { service, claude, jev, sheetReader, sheetFiles, entries };
}

describe('AiService.readTaste', () => {
  it('does nothing while the AI helpers are off', async () => {
    const { service, claude } = setup({ settings: { enabled: false, tasteProvider: 'claude' } });
    expect(await service.readTaste('tart')).toEqual(err({ kind: 'off' }));
    expect(claude.readTaste).not.toHaveBeenCalled();
  });

  it('reads with the chosen provider and its key', async () => {
    const { service, jev, claude } = setup({ settings: { enabled: true, tasteProvider: 'jev' } });
    expect(await service.readTaste('tart')).toEqual(ok(['sour']));
    expect(jev.readTaste).toHaveBeenCalledWith('tart', 'ts-jev');
    expect(claude.readTaste).not.toHaveBeenCalled();
  });

  it('uses the other provider when the chosen one has no key', async () => {
    const { service, claude } = setup({
      settings: { enabled: true, tasteProvider: 'jev' },
      keys: { claude: 'sk-claude' },
    });
    await service.readTaste('tart');
    expect(claude.readTaste).toHaveBeenCalledWith('tart', 'sk-claude');
  });

  it('says no key, naming the chosen provider, when neither has one', async () => {
    const { service } = setup({ settings: { enabled: true, tasteProvider: 'jev' }, keys: {} });
    expect(await service.readTaste('tart')).toEqual(err({ kind: 'no-key', provider: 'jev' }));
  });

  it('runs one read at a time: a second while one runs is busy', async () => {
    const { service, claude } = setup();
    let finish: () => void = () => undefined;
    vi.mocked(claude.readTaste).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => {
            resolve(ok([]));
          };
        }),
    );
    const first = service.readTaste('tart');
    expect(await service.readTaste('bitter')).toEqual(err({ kind: 'busy' }));
    await vi.waitFor(() => {
      expect(claude.readTaste).toHaveBeenCalledTimes(1);
    });
    finish();
    expect(await first).toEqual(ok([]));
    expect(await service.readTaste('bitter')).toEqual(ok(['sour']));
  });

  it('frees the read when a reader throws', async () => {
    const { service, claude } = setup();
    vi.mocked(claude.readTaste).mockRejectedValueOnce(new Error('bug'));
    await expect(service.readTaste('tart')).rejects.toThrow('bug');
    expect(await service.readTaste('tart')).toEqual(ok(['sour']));
  });

  it('logs the size and time of a read, never the words', async () => {
    const { service, entries } = setup();
    await service.readTaste('secret words');
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: 'ai.read',
        context: { helper: 'taste', provider: 'claude', size: 12, ok: true, durationMs: 250 },
      }),
    );
    expect(JSON.stringify(entries)).not.toContain('secret words');
  });
});

describe('AiService.readSpecSheet', () => {
  it('needs the helpers on and a Claude key, whatever reads tasting words', async () => {
    const off = setup({ settings: { enabled: false, tasteProvider: 'claude' } });
    expect(await off.service.readSpecSheet({ kind: 'text', text: 'x' }, PARENT)).toEqual(
      err({ kind: 'off' }),
    );
    const jevOnly = setup({ keys: { jev: 'ts-jev' } });
    expect(await jevOnly.service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      err({ kind: 'no-key', provider: 'claude' }),
    );
    expect(jevOnly.sheetFiles.choosePdf).not.toHaveBeenCalled();
  });

  it('reads pasted text into the fields the form takes', async () => {
    const { service, sheetReader } = setup();
    expect(await service.readSpecSheet({ kind: 'text', text: 'Kenya AA' }, PARENT)).toEqual(
      ok({ status: 'read', fields: { origin: 'Kenya' } }),
    );
    expect(sheetReader.readSpecSheet).toHaveBeenCalledWith(
      { kind: 'text', text: 'Kenya AA' },
      'sk-claude',
    );
  });

  it('reads the PDF you pick', async () => {
    const { service, sheetReader, sheetFiles } = setup();
    expect(await service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      ok({ status: 'read', fields: { origin: 'Kenya' } }),
    );
    expect(sheetFiles.choosePdf).toHaveBeenCalledWith(PARENT);
    expect(sheetReader.readSpecSheet).toHaveBeenCalledWith(
      { kind: 'pdf', bytes: pdf(2) },
      'sk-claude',
    );
  });

  it('does nothing when you cancel the dialog', async () => {
    const { service, sheetReader } = setup({
      files: { choosePdf: () => Promise.resolve(undefined) },
    });
    expect(await service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      ok({ status: 'cancelled' }),
    );
    expect(sheetReader.readSpecSheet).not.toHaveBeenCalled();
  });

  it('refuses a PDF over 10 MB without reading it', async () => {
    const { service, sheetFiles } = setup({
      files: { sizeOf: () => Promise.resolve(10 * 1024 * 1024 + 1) },
    });
    expect(await service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      err({ kind: 'too-long', limit: '10 MB' }),
    );
    expect(sheetFiles.readBytes).not.toHaveBeenCalled();
  });

  it('refuses a PDF over 20 pages, and sends one of 20', async () => {
    const long = setup({ files: { readBytes: () => Promise.resolve(pdf(21)) } });
    expect(await long.service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      err({ kind: 'too-long', limit: '20 pages' }),
    );
    expect(long.sheetReader.readSpecSheet).not.toHaveBeenCalled();
    const twenty = setup({ files: { readBytes: () => Promise.resolve(pdf(20)) } });
    expect(await twenty.service.readSpecSheet({ kind: 'pdf' }, PARENT)).toMatchObject({ ok: true });
  });

  it('calls a file that is not a PDF unreadable', async () => {
    const { service } = setup({
      files: { readBytes: () => Promise.resolve(new Uint8Array(Buffer.from('PK zip'))) },
    });
    expect(await service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      err({ kind: 'unreadable', provider: 'claude' }),
    );
  });

  it('says it failed when the file cannot be read, and logs why', async () => {
    const { service, entries } = setup({
      files: { readBytes: () => Promise.reject(new Error('EACCES')) },
    });
    expect(await service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      err({ kind: 'failed', provider: 'claude' }),
    );
    expect(entries.map((e) => e.event)).toContain('ai.sheet-read-failed');
  });

  it('passes on a reader failure', async () => {
    const { service, sheetReader } = setup();
    vi.mocked(sheetReader.readSpecSheet).mockResolvedValueOnce(
      err({ kind: 'rate-limited', provider: 'claude' }),
    );
    expect(await service.readSpecSheet({ kind: 'text', text: 'x' }, PARENT)).toEqual(
      err({ kind: 'rate-limited', provider: 'claude' }),
    );
  });

  it('reads an empty sheet as no fields, and logs it', async () => {
    const { service, sheetReader, entries } = setup();
    vi.mocked(sheetReader.readSpecSheet).mockResolvedValueOnce(ok(EMPTY_SHEET));
    expect(await service.readSpecSheet({ kind: 'text', text: 'x' }, PARENT)).toEqual(
      ok({ status: 'read', fields: {} }),
    );
    expect(entries.map((e) => e.event)).toContain('ai.sheet-empty');
  });

  it('reads a sheet while tasting words are being read', async () => {
    const { service, claude } = setup();
    vi.mocked(claude.readTaste).mockReturnValueOnce(new Promise(() => undefined));
    void service.readTaste('tart');
    expect(await service.readSpecSheet({ kind: 'text', text: 'x' }, PARENT)).toMatchObject({
      ok: true,
    });
  });
});

describe('pdfPageCount', () => {
  it('counts page objects, not the page tree', () => {
    expect(pdfPageCount(pdf(3))).toBe(3);
    expect(pdfPageCount(pdf(0))).toBe(0);
    expect(pdfPageCount(new Uint8Array(Buffer.from('/Type/Page /Type /Page/Contents')))).toBe(2);
  });
});
