import { describe, expect, it } from 'vitest';
import { reasonLine, suggestionText } from './taste-format';

describe('suggestionText', () => {
  it('puts the change in numbers first: times as m:ss, temperatures in the unit', () => {
    expect(
      suggestionText(
        {
          kind: 'change',
          change: { field: 'devTimeS', from: 105, to: 120 },
          reason: { kind: 'under-developed' },
        },
        'c',
      ),
    ).toEqual({
      change: 'Development 1:45 → 2:00',
      line: 'Sour or grassy often means under-developed',
    });
    expect(
      suggestionText(
        {
          kind: 'change',
          change: { field: 'capC', from: 215, to: 212 },
          reason: { kind: 'drop-cooler' },
        },
        'f',
      ).change,
    ).toBe('BT cap 419 °F → 414 °F');
    expect(
      suggestionText(
        {
          kind: 'change',
          change: { field: 'chargeC', from: 180, to: 185 },
          reason: { kind: 'slow-roast', totalS: 820 },
        },
        'c',
      ),
    ).toEqual({
      change: 'Charge 180 °C → 185 °C',
      line: 'Flat or baked often means a slow roast · 13:40 · more heat early',
    });
  });

  it('shows only the line when there is no change', () => {
    expect(suggestionText({ kind: 'none', reason: { kind: 'mixed' } }, 'c')).toEqual({
      line: 'Mixed signals · change one thing at a time',
    });
  });
});

describe('reasonLine', () => {
  it.each([
    [{ kind: 'balanced' as const }, 'Sounds right · star it to roast it again'],
    [{ kind: 'over-developed' as const }, 'Bitter or roasty often means too much development'],
    [
      { kind: 'already-developed' as const, share: 0.224 },
      'Development is already 22 % · check grind and brew first',
    ],
    [
      { kind: 'after-finding' as const, finding: 'stall' as const, atS: 372 },
      'Flat or baked often follows a stall · 6:12 · see Roast report',
    ],
    [{ kind: 'no-first-crack' as const }, "No first crack marked · development can't be judged"],
    [{ kind: 'needs-auto' as const }, 'Roast on Auto to get a suggestion'],
    [
      { kind: 'at-limit' as const, field: 'devTimeS' as const, from: 600, to: 615 },
      'Development 10:00 is at its limit',
    ],
  ])('%j', (reason, line) => {
    expect(reasonLine(reason, 'c')).toBe(line);
  });

  it('says a temperature limit in the unit', () => {
    expect(reasonLine({ kind: 'at-limit', field: 'chargeC', from: 228, to: 233 }, 'f')).toBe(
      'Charge 442 °F is at its limit',
    );
  });
});
