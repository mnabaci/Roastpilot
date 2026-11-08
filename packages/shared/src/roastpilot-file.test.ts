import { describe, expect, it } from 'vitest';
import { FILE_KINDS, readEnvelope, toEnvelope } from './roastpilot-file';

const file = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: 'roastpilot-beans',
    version: 1,
    exportedAt: '2026-11-08T10:00:00.000Z',
    beans: [{ name: 'Guji' }],
    ...over,
  });

describe('Roastpilot file envelope', () => {
  it('names each kind and its version: roasts stay at 2, the rest start at 1', () => {
    expect(FILE_KINDS.roasts).toMatchObject({ format: 'roastpilot-roasts', version: 2 });
    expect(FILE_KINDS.beans).toMatchObject({ format: 'roastpilot-beans', version: 1 });
    expect(FILE_KINDS.profiles).toMatchObject({ format: 'roastpilot-profiles', version: 1 });
    expect(FILE_KINDS.roasters).toMatchObject({ format: 'roastpilot-roasters', version: 1 });
  });

  it('writes format, version, exportedAt, then the items under the kind', () => {
    const written = toEnvelope('profiles', [1], new Date('2026-11-08T10:00:00.000Z'));
    expect(JSON.stringify(written)).toBe(
      '{"format":"roastpilot-profiles","version":1,"exportedAt":"2026-11-08T10:00:00.000Z","profiles":[1]}',
    );
  });

  it('reads back the items and the version', () => {
    expect(readEnvelope(file(), 'beans')).toEqual({
      ok: true,
      value: { version: 1, items: [{ name: 'Guji' }] },
    });
  });

  it.each([
    ['not JSON', 'nope'],
    ['JSON that is not an object', '[1, 2]'],
    ['null', 'null'],
    ['another JSON file', '{"name":"package"}'],
    ['an unknown format', file({ format: 'roastpilot-teas' })],
    ['no items', file({ beans: undefined })],
    ['items that are not a list', file({ beans: { name: 'Guji' } })],
    ['no exportedAt', file({ exportedAt: undefined })],
    ['a version that is not a whole number', file({ version: 0.5 })],
    ['a version above this one that is not a whole number', file({ version: 1.5 })],
    ['version 0', file({ version: 0 })],
    ['a version that is not a number', file({ version: '1' })],
  ])('refuses %s', (_, text) => {
    expect(readEnvelope(text, 'beans')).toEqual({ ok: false, error: { kind: 'not-roastpilot' } });
  });

  it('refuses a file from a newer Roastpilot', () => {
    expect(readEnvelope(file({ version: 2 }), 'beans')).toEqual({
      ok: false,
      error: { kind: 'newer-version' },
    });
  });

  it('refuses another kind by name, even a newer one', () => {
    expect(readEnvelope(file(), 'profiles')).toEqual({
      ok: false,
      error: { kind: 'wrong-kind', fileKind: 'beans' },
    });
    expect(readEnvelope(file({ version: 9 }), 'roasts')).toEqual({
      ok: false,
      error: { kind: 'wrong-kind', fileKind: 'beans' },
    });
  });
});
