import { tempInText } from '@roastpilot/shared';
import { describe, expect, it } from 'vitest';
import { importedText, importProblemText } from './file-messages';

describe('file messages', () => {
  it('counts what came in and what was already here, singular and plural', () => {
    expect(importedText('profiles', 3, 1)).toBe('Imported 3 profiles · 1 was already here');
    expect(importedText('beans', 1, 2)).toBe('Imported 1 bean · 2 were already here');
    expect(importedText('roasters', 1, 0)).toBe('Imported 1 roaster');
    expect(importedText('roasts', 0, 4)).toBe('Imported 0 roasts · 4 were already here');
  });

  it('refuses another kind by name, saying where it goes', () => {
    expect(importProblemText({ kind: 'wrong-kind', fileKind: 'beans' }, 'c')).toBe(
      'This is a beans file · import it on Beans',
    );
    expect(importProblemText({ kind: 'wrong-kind', fileKind: 'roasts' }, 'c')).toBe(
      'This is a roasts file · import it on History',
    );
  });

  it('says which item failed its checks and why', () => {
    expect(
      importProblemText({ kind: 'bad-item', name: 'Light', reason: 'BT cap: At most 235 °C' }, 'c'),
    ).toBe('"Light" can\'t come in · BT cap: At most 235 °C');
  });

  it('says a refused temperature in °F when the screen shows °F', () => {
    const reason = `BT cap: At most ${tempInText(235)}`;
    expect(importProblemText({ kind: 'bad-item', name: 'Light', reason }, 'f')).toBe(
      '"Light" can\'t come in · BT cap: At most 455 °F',
    );
  });

  it.each([
    ['not-roastpilot', "That file isn't a Roastpilot file"],
    ['newer-version', 'That file is from a newer Roastpilot · update to import it'],
    ['read-failed', "Couldn't read that file · see Logs"],
    ['not-artisan', "That file isn't an Artisan roast"],
    ['storage-failed', "Couldn't import · see Logs"],
  ])('%s: one line', (kind, text) => {
    expect(importProblemText({ kind }, 'c')).toBe(text);
  });
});
