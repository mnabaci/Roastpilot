import { describe, expect, it } from 'vitest';
import {
  ReadSpecSheetRequestSchema,
  ReadTasteRequestSchema,
  SaveAiKeyRequestSchema,
  SPEC_SHEET_TEXT_MAX,
  SpecSheetFieldsSchema,
} from './ai';
import { SettingsSchema } from './settings';

describe('AI settings', () => {
  it('starts off, no reader chosen, for a settings file from before', () => {
    expect(SettingsSchema.parse({}).ai).toEqual({ enabled: false, tasteProvider: null });
  });

  it('falls back to the defaults for values it cannot read', () => {
    expect(
      SettingsSchema.parse({ ai: { enabled: 'yes', tasteProvider: 'Not an id!' } }).ai,
    ).toEqual({
      enabled: false,
      tasteProvider: null,
    });
    expect(SettingsSchema.parse({ ai: 'on' }).ai).toEqual({ enabled: false, tasteProvider: null });
  });

  it('keeps the provider picked, by its id', () => {
    expect(SettingsSchema.parse({ ai: { enabled: true, tasteProvider: 'jev' } }).ai).toEqual({
      enabled: true,
      tasteProvider: 'jev',
    });
  });
});

describe('SaveAiKeyRequestSchema', () => {
  it('trims the key', () => {
    expect(SaveAiKeyRequestSchema.parse({ provider: 'jev', key: '  sk-12345678  ' }).key).toBe(
      'sk-12345678',
    );
  });

  it.each([
    ['too short', { provider: 'claude', key: 'abc' }],
    ['only spaces', { provider: 'claude', key: '          ' }],
    ['too long', { provider: 'claude', key: 'k'.repeat(401) }],
    ['an id that is not one', { provider: 'GPT 4', key: 'sk-12345678' }],
    ['broken by a line break', { provider: 'claude', key: 'sk-ant-1234\n5678' }],
    ['with a space inside', { provider: 'claude', key: 'sk-ant 12345678' }],
    ['with letters outside ASCII', { provider: 'claude', key: 'sk-ant-12345678é' }],
  ])('refuses a key that is %s', (_name, input) => {
    expect(SaveAiKeyRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe('read requests', () => {
  it('refuses empty or blank tasting words', () => {
    expect(ReadTasteRequestSchema.safeParse({ words: '' }).success).toBe(false);
    expect(ReadTasteRequestSchema.safeParse({ words: '   ' }).success).toBe(false);
  });

  it('takes pasted text up to the limit, and a PDF without a path', () => {
    const atLimit = { kind: 'text', text: 'x'.repeat(SPEC_SHEET_TEXT_MAX) };
    expect(ReadSpecSheetRequestSchema.safeParse(atLimit).success).toBe(true);
    const over = { kind: 'text', text: 'x'.repeat(SPEC_SHEET_TEXT_MAX + 1) };
    expect(ReadSpecSheetRequestSchema.safeParse(over).success).toBe(false);
    expect(ReadSpecSheetRequestSchema.parse({ kind: 'pdf', path: '/etc/passwd' })).toEqual({
      kind: 'pdf',
    });
  });
});

describe('SpecSheetFieldsSchema', () => {
  it('takes only some fields', () => {
    expect(SpecSheetFieldsSchema.parse({ origin: 'Ethiopia', altitudeM: 1900 })).toEqual({
      origin: 'Ethiopia',
      altitudeM: 1900,
    });
  });

  it('refuses a value the bean form would refuse', () => {
    expect(SpecSheetFieldsSchema.safeParse({ moisturePct: 150 }).success).toBe(false);
    expect(SpecSheetFieldsSchema.safeParse({ process: 'anaerobic' }).success).toBe(false);
    expect(SpecSheetFieldsSchema.safeParse({ altitudeM: -5 }).success).toBe(false);
  });
});
