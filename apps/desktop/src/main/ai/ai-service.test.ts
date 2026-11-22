import { createLogger, type SpecSheetReader, type TasteReader } from '@roastpilot/core';
import {
  err,
  ok,
  type AiProviderId,
  type AiSettings,
  type LogEntry,
  type RawSpecSheet,
} from '@roastpilot/shared';
import { describe, expect, it, vi } from 'vitest';
import type { DialogParent } from '../files/file-dialogs';
import { AiService } from './ai-service';
import type { SheetFiles } from './sheet-pdf';

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
  new Uint8Array(Buffer.from(`%PDF-1.7\n${'<< /Type /Page >>\n'.repeat(pages)}%%EOF`));

function tasteReader(provider: AiProviderId): TasteReader {
  return {
    provider,
    modelName: `${provider} 1`,
    readTaste: vi.fn(() => Promise.resolve(ok(['sour' as const]))),
  };
}

function setup({
  settings = { enabled: true, tasteProvider: 'claude' },
  keys = { claude: 'sk-claude', jev: 'ts-jev' },
  files = {},
}: {
  settings?: AiSettings;
  keys?: Partial<Record<AiProviderId, string>>;
  files?: Partial<SheetFiles>;
} = {}) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const claude = tasteReader('claude');
  const jev = tasteReader('jev');
  const sheetReader: SpecSheetReader = {
    provider: 'claude',
    modelName: 'claude big',
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
    keys: {
      read: (provider) => Promise.resolve(keys[provider]),
      status: () =>
        Promise.resolve(
          Object.fromEntries(
            Object.entries(keys).map(([id, key]) => [
              id,
              { saved: true, last4: key?.slice(-4) ?? null },
            ]),
          ),
        ),
    },
    providers: [
      {
        info: { id: 'claude', label: 'Claude', company: 'Anthropic', keyFrom: 'a.example' },
        taste: claude,
        specSheet: sheetReader,
      },
      { info: { id: 'jev', label: 'Jev', company: 'TypeSafe', keyFrom: 'b.example' }, taste: jev },
    ],
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

  it('says no key when no provider that reads tasting words has one', async () => {
    const { service } = setup({ settings: { enabled: true, tasteProvider: 'jev' }, keys: {} });
    expect(await service.readTaste('tart')).toEqual(err({ kind: 'no-key' }));
  });

  it('reads with the first provider that can when none is chosen', async () => {
    const { service, claude } = setup({ settings: { enabled: true, tasteProvider: null } });
    await service.readTaste('tart');
    expect(claude.readTaste).toHaveBeenCalledWith('tart', 'sk-claude');
  });

  it('reads with the next provider when all the chosen one’s models are retired', async () => {
    const { service, claude, jev } = setup();
    vi.mocked(claude.readTaste).mockResolvedValueOnce(
      err({ kind: 'model-retired', provider: 'claude' }),
    );
    expect(await service.readTaste('tart')).toEqual(ok(['sour']));
    expect(jev.readTaste).toHaveBeenCalledWith('tart', 'ts-jev');
  });

  it('says retired when every provider with a key is retired', async () => {
    const { service, claude, jev } = setup();
    vi.mocked(claude.readTaste).mockResolvedValueOnce(
      err({ kind: 'model-retired', provider: 'claude' }),
    );
    vi.mocked(jev.readTaste).mockResolvedValueOnce(err({ kind: 'model-retired', provider: 'jev' }));
    expect(await service.readTaste('tart')).toEqual(
      err({ kind: 'model-retired', provider: 'jev' }),
    );
  });

  it('tries no other provider after any other failure', async () => {
    const { service, claude, jev } = setup();
    vi.mocked(claude.readTaste).mockResolvedValueOnce(err({ kind: 'offline', provider: 'claude' }));
    expect(await service.readTaste('tart')).toEqual(err({ kind: 'offline', provider: 'claude' }));
    expect(jev.readTaste).not.toHaveBeenCalled();
  });

  it('drops an answer that came after the helpers were turned off', async () => {
    const settings: AiSettings = { enabled: true, tasteProvider: 'claude' };
    const { service, claude } = setup({ settings });
    vi.mocked(claude.readTaste).mockImplementationOnce(() => {
      settings.enabled = false;
      return Promise.resolve(ok(['sour' as const]));
    });
    expect(await service.readTaste('tart')).toEqual(err({ kind: 'off' }));
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
      err({ kind: 'no-key' }),
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

  it('refuses a PDF that grew past 10 MB after it was measured', async () => {
    const { service } = setup({
      files: { readBytes: () => Promise.resolve(new Uint8Array(10 * 1024 * 1024 + 1)) },
    });
    expect(await service.readSpecSheet({ kind: 'pdf' }, PARENT)).toEqual(
      err({ kind: 'too-long', limit: '10 MB' }),
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

  it('passes on a retired sheet model when no other provider reads sheets', async () => {
    const { service, sheetReader } = setup();
    vi.mocked(sheetReader.readSpecSheet).mockResolvedValueOnce(
      err({ kind: 'model-retired', provider: 'claude' }),
    );
    expect(await service.readSpecSheet({ kind: 'text', text: 'x' }, PARENT)).toEqual(
      err({ kind: 'model-retired', provider: 'claude' }),
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

describe('AiService.list', () => {
  it('lists each provider with the model for each job and its key, never the key itself', async () => {
    const { service } = setup({ keys: { jev: 'ts-jev-secret' } });
    const list = await service.list();
    expect(list).toEqual([
      {
        id: 'claude',
        label: 'Claude',
        company: 'Anthropic',
        keyFrom: 'a.example',
        models: { taste: 'claude 1', specSheet: 'claude big' },
        key: { saved: false, last4: null },
      },
      {
        id: 'jev',
        label: 'Jev',
        company: 'TypeSafe',
        keyFrom: 'b.example',
        models: { taste: 'jev 1', specSheet: null },
        key: { saved: true, last4: 'cret' },
      },
    ]);
    expect(JSON.stringify(list)).not.toContain('ts-jev-secret');
  });
});
