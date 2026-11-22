import { createLogger } from '@roastpilot/core';
import type { LogEntry } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { openDatabase } from './open-database';
import { drizzleOn } from './proxy-db';
import { tasteTagsJson, toTasteTags } from './roast-rows';
import { SqliteRoastRepository } from './sqlite-roast-repository';

function setup() {
  const entries: LogEntry[] = [];
  const logger = createLogger({ write: (e) => entries.push(e) }, 'storage');
  const opened = openDatabase(':memory:', logger);
  if (!opened.ok) throw new Error(opened.error.kind);
  const sqlite = opened.value;
  return { sqlite, entries, repository: new SqliteRoastRepository(drizzleOn(sqlite), logger) };
}

async function created(repository: SqliteRoastRepository) {
  const result = await repository.create({
    startedAt: '2026-11-20T10:00:00.000Z',
    mode: 'manual',
    profile: null,
    roasterId: null,
    beanId: null,
    batchG: null,
    ghostRoastId: null,
  });
  if (!result.ok) throw new Error('create failed');
  return result.value;
}

describe('roast taste', () => {
  it('starts with no tags and no words', async () => {
    const { repository } = setup();
    const id = await created(repository);
    expect(await repository.get(id)).toMatchObject({
      ok: true,
      value: { tasteTags: [], tasteWords: null },
    });
  });

  it('saves tags in their order and words, and reads them in the list too', async () => {
    const { repository } = setup();
    const id = await created(repository);
    expect(
      await repository.saveTaste({ id, tags: ['roasty', 'sour', 'sour'], words: 'tart, ashy' }),
    ).toEqual({ ok: true, value: undefined });
    expect(await repository.get(id)).toMatchObject({
      value: { tasteTags: ['sour', 'roasty'], tasteWords: 'tart, ashy' },
    });
    const list = await repository.list();
    expect(list.ok && list.value[0]).toMatchObject({
      tasteTags: ['sour', 'roasty'],
      tasteWords: 'tart, ashy',
    });
  });

  it('clears tags and words', async () => {
    const { repository, sqlite } = setup();
    const id = await created(repository);
    await repository.saveTaste({ id, tags: ['flat'], words: 'dull' });
    await repository.saveTaste({ id, tags: [], words: null });
    expect(sqlite.prepare('SELECT taste_tags, taste_words FROM roasts').get()).toEqual({
      taste_tags: null,
      taste_words: null,
    });
  });

  it('says not-found for a roast that is gone', async () => {
    const { repository } = setup();
    expect(await repository.saveTaste({ id: 99, tags: ['sour'], words: null })).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 99 },
    });
  });

  it('drops a tag it does not know, keeps the rest and logs it', async () => {
    const { repository, sqlite, entries } = setup();
    const id = await created(repository);
    sqlite.prepare(`UPDATE roasts SET taste_tags = '["sour","smoky"]'`).run();
    expect(await repository.get(id)).toMatchObject({ value: { tasteTags: ['sour'] } });
    expect(entries).toContainEqual(
      expect.objectContaining({
        event: 'storage.taste-unreadable',
        context: { roastId: id, dropped: 1 },
      }),
    );
  });
});

describe('taste columns', () => {
  it('stores no tags as null', () => {
    expect(tasteTagsJson([])).toBeNull();
    expect(tasteTagsJson(['thin', 'grassy'])).toBe('["grassy","thin"]');
  });

  it.each([
    ['no column', null, { tags: [], dropped: 0 }],
    ['broken JSON', '["sour"', { tags: [], dropped: 1 }],
    ['not a list', '{"sour":true}', { tags: [], dropped: 1 }],
    ['a number in the list', '["sour",3]', { tags: ['sour'], dropped: 1 }],
  ])('reads %s', (_name, json, expected) => {
    expect(toTasteTags(json)).toEqual(expected);
  });
});
