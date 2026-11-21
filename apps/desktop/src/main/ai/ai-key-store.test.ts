import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AiKeyStore, keyFileName, type KeyCipher, type KeyFiles } from './ai-key-store';

const DIR = join('user-data');
const missing = () => Object.assign(new Error('missing'), { code: 'ENOENT' });

/** Files in memory; `failWrite` and `failRemove` make those calls throw. */
function memoryFiles(options: { failWrite?: boolean; failRemove?: boolean } = {}) {
  const files = new Map<string, Buffer>();
  const api: KeyFiles = {
    read: (path) => {
      const data = files.get(path);
      return data ? Promise.resolve(data) : Promise.reject(missing());
    },
    write: (path, data) => {
      if (options.failWrite) return Promise.reject(new Error('disk full'));
      files.set(path, data);
      return Promise.resolve();
    },
    rename: (from, to) => {
      const data = files.get(from);
      if (!data) return Promise.reject(missing());
      files.set(to, data);
      files.delete(from);
      return Promise.resolve();
    },
    remove: (path) => {
      if (options.failRemove) return Promise.reject(new Error('locked'));
      return files.delete(path) ? Promise.resolve() : Promise.reject(missing());
    },
  };
  return { files, api };
}

/** Keys are ASCII; reversed as code units, so a test can tell a stored key from a typed one. */
const reversed = (text: string) =>
  Array.from(text, (c) => c)
    .reverse()
    .join('');

/** "Encrypts" by reversing. */
const cipher = (available = true): KeyCipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (plain) => Buffer.from(reversed(plain)),
  decryptString: (data) => {
    const text = data.toString();
    if (text.startsWith('BAD')) throw new Error('not this keychain');
    return reversed(text);
  },
});

function setup(options: { available?: boolean; failWrite?: boolean; failRemove?: boolean } = {}) {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'ai');
  const { files, api } = memoryFiles(options);
  const store = new AiKeyStore({
    dir: DIR,
    providers: ['claude', 'jev'],
    cipher: cipher(options.available),
    files: api,
    logger,
  });
  return { store, files, entries };
}

const none = { saved: false, last4: null };

describe('AiKeyStore', () => {
  it('has no keys at first', async () => {
    const { store } = setup();
    expect(await store.status()).toEqual({ claude: none, jev: none });
    expect(await store.read('claude')).toBeUndefined();
  });

  it('saves a key encrypted, and shows only its last four characters', async () => {
    const { store, files } = setup();
    expect(await store.save('claude', 'sk-ant-abcd1234')).toEqual({
      ok: true,
      value: { claude: { saved: true, last4: '1234' }, jev: none },
    });
    const stored = files.get(join(DIR, keyFileName('claude')))?.toString();
    expect(stored).toBe('4321dcba-tna-ks');
    expect(await store.read('claude')).toBe('sk-ant-abcd1234');
    expect([...files.keys()].some((path) => path.endsWith('.tmp'))).toBe(false);
  });

  it('keeps each provider apart, and replaces a key on save', async () => {
    const { store } = setup();
    await store.save('claude', 'first-key-1111');
    await store.save('jev', 'jev-key-2222');
    await store.save('claude', 'second-key-3333');
    expect(await store.status()).toEqual({
      claude: { saved: true, last4: '3333' },
      jev: { saved: true, last4: '2222' },
    });
  });

  it('refuses to save where the keychain cannot encrypt, writing nothing', async () => {
    const { store, files, entries } = setup({ available: false });
    expect(await store.save('claude', 'sk-ant-abcd1234')).toEqual({
      ok: false,
      error: { kind: 'unsafe-storage' },
    });
    expect(files.size).toBe(0);
    expect(entries.map((e) => e.event)).toContain('ai.key-not-saved');
  });

  it('says why a write failed, leaves no temp file and logs no key', async () => {
    const { store, files, entries } = setup({ failWrite: true });
    const saved = await store.save('jev', 'ts-secret-key');
    expect(saved).toMatchObject({ ok: false, error: { kind: 'storage-failed' } });
    expect(files.size).toBe(0);
    expect(JSON.stringify(entries)).not.toContain('ts-secret-key');
  });

  it('removes a key, and a key that is not there is already removed', async () => {
    const { store } = setup();
    await store.save('claude', 'sk-ant-abcd1234');
    expect(await store.remove('claude')).toEqual({ ok: true, value: { claude: none, jev: none } });
    expect(await store.remove('claude')).toEqual({ ok: true, value: { claude: none, jev: none } });
  });

  it('says why a remove failed', async () => {
    const { store } = setup({ failRemove: true });
    expect(await store.remove('jev')).toMatchObject({
      ok: false,
      error: { kind: 'storage-failed' },
    });
  });

  it('treats a key it cannot decrypt as none, logged, until a new one is saved', async () => {
    const { store, files, entries } = setup();
    files.set(join(DIR, keyFileName('claude')), Buffer.from('BAD-from-another-computer'));
    expect(await store.read('claude')).toBeUndefined();
    expect(entries.map((e) => e.event)).toContain('ai.key-unreadable');
    await store.save('claude', 'sk-ant-new-9999');
    expect(await store.read('claude')).toBe('sk-ant-new-9999');
  });

  it('treats an empty key file as no key', async () => {
    const { store, files } = setup();
    files.set(join(DIR, keyFileName('jev')), Buffer.from(''));
    expect(await store.status()).toEqual({ claude: none, jev: none });
  });

  it('refuses a key for a provider that is not registered, writing nothing', async () => {
    const { store, files } = setup();
    expect(await store.save('other', 'sk-12345678')).toEqual({
      ok: false,
      error: { kind: 'unknown-provider' },
    });
    expect(await store.remove('other')).toEqual({ ok: false, error: { kind: 'unknown-provider' } });
    expect(await store.read('other')).toBeUndefined();
    expect(files.size).toBe(0);
  });

  it('runs a quick save then remove in order', async () => {
    const { store } = setup();
    const saving = store.save('jev', 'jev-key-2222');
    const removing = store.remove('jev');
    await saving;
    expect(await removing).toEqual({ ok: true, value: { claude: none, jev: none } });
  });
});
