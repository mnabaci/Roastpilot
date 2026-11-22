import { describe, expect, it } from 'vitest';
import { preloadImportProblems } from './preload-imports';

const chunk = (fileName: string, imports: string[], dynamicImports: string[] = []) => ({
  type: 'chunk' as const,
  fileName,
  imports,
  dynamicImports,
});

describe('preloadImportProblems', () => {
  it('lets the preload load electron', () => {
    expect(preloadImportProblems({ 'index.cjs': chunk('index.cjs', ['electron']) })).toEqual([]);
  });

  it('names each package a sandboxed preload could not load', () => {
    expect(
      preloadImportProblems({ 'index.cjs': chunk('index.cjs', ['electron', 'zod'], ['nanoid']) }),
    ).toEqual(['index.cjs loads zod', 'index.cjs loads nanoid']);
  });

  it('counts the preload’s own chunks as bundled code, and skips assets', () => {
    expect(
      preloadImportProblems({
        'index.cjs': chunk('index.cjs', ['electron', 'shared-a1b2.cjs', './local.cjs']),
        'shared-a1b2.cjs': chunk('shared-a1b2.cjs', []),
        'notes.txt': { type: 'asset', fileName: 'notes.txt' },
      }),
    ).toEqual([]);
  });

  it('flags a built-in too: the preload keeps to electron', () => {
    expect(preloadImportProblems({ 'index.cjs': chunk('index.cjs', ['node:fs']) })).toEqual([
      'index.cjs loads node:fs',
    ]);
  });
});
