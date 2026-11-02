import { describe, expect, it } from 'vitest';
import { parseReadReply, parseVersionReply } from './replies';

describe('parseReadReply', () => {
  it('reads temperature, heater and fan', () => {
    expect(parseReadReply('0.00,180.25,180.25,40,60,0')).toEqual({
      ok: true,
      value: { bt: 180.25, heater: 40, fan: 60 },
    });
  });

  it('accepts a trailing carriage return', () => {
    expect(parseReadReply('0.00,42.39,42.39,30,0,0\r').ok).toBe(true);
  });

  it.each([
    '',
    '1',
    '0.00,42.39,42.39,30,0',
    '0.00,42.39,42.39,30,0,0,9',
    '0.00,abc,42.39,30,0,0',
    '0.00,,42.39,30,0,0',
  ])('rejects %j as a bad reply', (line) => {
    expect(parseReadReply(line)).toEqual({ ok: false, error: { kind: 'bad-reply', line } });
  });
});

describe('parseVersionReply', () => {
  it('reads a whole number', () => {
    expect(parseVersionReply('1\r')).toEqual({ ok: true, value: 1 });
  });

  it.each(['', 'v1', '1.5', '0.00,42.39,42.39,30,0,0'])('rejects %j', (line) => {
    expect(parseVersionReply(line).ok).toBe(false);
  });
});
