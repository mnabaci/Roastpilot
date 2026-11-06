import { describe, expect, it } from 'vitest';
import { parseArtisan } from './artisan-import';
import { parsePythonLiteral } from './python-literal';

const PYTHON_ALOG = `{'mode': 'C', 'title': 'Sunday', 'beans': "Kenya 'AA'", 'roastepoch': 1000,
 'weight': [0.4, 0.34, 'Kg'], 'flag': True, 'none': None,
 'timex': [0.0, 10.0, 70.0, 130.0, 190.0, 250.0],
 'temp1': [200.0, 190.0, -1, 210.0, 220.0, 230.0],
 'temp2': [25.0, 180.0, 100.0, -1, 196.0, 205.0],
 'timeindex': [1, 2, 3, 0, 0, 0, 4, 5]}`;

describe('parsePythonLiteral', () => {
  it('reads Python and JSON alike', () => {
    expect(parsePythonLiteral(`{'a': (1, -2.5e1,), "b": [True, None, u'x\\n']}`)).toEqual({
      a: [1, -25],
      b: [true, null, 'x\n'],
    });
    expect(parsePythonLiteral('{"a": [1, false, null]}')).toEqual({ a: [1, false, null] });
  });

  it('keeps a __proto__ key as plain data', () => {
    const value = parsePythonLiteral(`{'__proto__': {'polluted': 1}}`) as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each(['{', `{'a' 1}`, '[1 2]', 'os.system("x")', '{} trailing'])('refuses %s', (text) => {
    expect(() => parsePythonLiteral(text)).toThrow();
  });
});

describe('parseArtisan', () => {
  it('measures from charge, skips missing readings and maps the events', () => {
    const parsed = parseArtisan(PYTHON_ALOG);
    if (!parsed.ok) throw new Error(parsed.error);
    const roast = parsed.value;
    expect(roast.samples.map((s) => s.tS)).toEqual([-10, 0, 60, 180, 240]);
    expect(roast.samples[2]?.values).toEqual({ bt: 100 });
    expect(roast.samples[1]?.values).toEqual({ bt: 180, et: 190 });
    expect(roast.events.map((e) => [e.kind, e.tS, e.bt])).toEqual([
      ['charge', 0, 180],
      ['dry-end', 60, 100],
      ['first-crack', 120, null],
      ['drop', 180, 196],
      ['cool-end', 240, 205],
    ]);
    expect(roast.fcTimeS).toBe(120);
    expect(roast.dropTimeS).toBe(180);
    expect(roast.dropTemp).toBe(196);
    expect(roast.startedAt).toBe(new Date(1_010_000).toISOString());
    expect(roast.endedAt).toBe(new Date(1_250_000).toISOString());
    expect(roast.batchG).toBe(400);
    expect(roast.roastedG).toBe(340);
    expect(roast.notes).toBe("Imported from Artisan · Sunday · Kenya 'AA'");
  });

  it('converts Fahrenheit files to °C', () => {
    const parsed = parseArtisan(
      `{'mode': 'F', 'roastepoch': 1, 'timex': [0], 'temp2': [212], 'timeindex': [0,0,0,0,0,0,0,0]}`,
    );
    expect(parsed.ok && parsed.value.samples[0]?.values.bt).toBe(100);
  });

  it('finishes a roast whose file has no drop at its last reading', () => {
    const parsed = parseArtisan(`{'roastepoch': 100, 'timex': [0, 60], 'temp2': [20, 90]}`);
    expect(parsed.ok && parsed.value.endedAt).toBe(new Date(160_000).toISOString());
    expect(parsed.ok && parsed.value.dropTimeS).toBeNull();
    expect(parsed.ok && parsed.value.batchG).toBeNull();
  });

  it.each([
    'not a roast',
    '[1, 2]',
    `{'title': 'no curves'}`,
    `{'roastepoch': 1, 'timex': [0], 'temp2': [-1]}`,
    `{'timex': [0], 'temp2': [20]}`,
  ])('refuses %s', (text) => {
    expect(parseArtisan(text).ok).toBe(false);
  });
});
