import { describe, expect, it } from 'vitest';
import {
  ACTIVE,
  ALL_ROASTERS,
  hasRoasterScope,
  NO_ROASTER,
  normalScope,
  roasterOf,
  roasterScopeOptions,
  roastsInScope,
  scopeName,
  scopeShowing,
} from './roaster-scope';

const SKYWALKER = { id: 1, name: 'Skywalker' };
const SIMULATOR = { id: 2, name: 'Simulator' };
const ARTISAN = { id: 3, name: 'Artisan box' };
const ROASTERS = [SKYWALKER, SIMULATOR, ARTISAN];
const roast = (id: number, roasterId: number | null) => ({ id, roasterId });
const ROASTS = [roast(1, 1), roast(2, 1), roast(3, 2), roast(4, null)];
const ids = (scope: string, activeId: number | undefined = 1) =>
  roastsInScope(ROASTS, scope, activeId).map((r) => r.id);

describe('roastsInScope', () => {
  it('lists the active roaster’s roasts, and follows it when another becomes active', () => {
    expect(ids(ACTIVE, 1)).toEqual([1, 2]);
    expect(ids(ACTIVE, 2)).toEqual([3]);
  });

  it('lists one roaster’s, every roast, or the ones with no roaster', () => {
    expect(ids('2')).toEqual([3]);
    expect(ids(ALL_ROASTERS)).toEqual([1, 2, 3, 4]);
    expect(ids(NO_ROASTER)).toEqual([4]);
  });

  it('lists every roast before the roasters are known', () => {
    expect(roastsInScope(ROASTS, ACTIVE, undefined).map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('hasRoasterScope', () => {
  it('has a roaster to choose with more than one roaster, or roasts with none', () => {
    expect(hasRoasterScope([SKYWALKER], [roast(1, 1)])).toBe(false);
    expect(hasRoasterScope([SKYWALKER, SIMULATOR], [roast(1, 1)])).toBe(true);
    expect(hasRoasterScope([SKYWALKER], [roast(1, null)])).toBe(true);
  });
});

describe('normalScope', () => {
  it('says the active roaster’s own id as active, so the picker shows it', () => {
    expect(normalScope('1', 1)).toBe(ACTIVE);
    expect(normalScope('2', 1)).toBe('2');
    expect(normalScope(ALL_ROASTERS, 1)).toBe(ALL_ROASTERS);
  });
});

describe('scopeShowing', () => {
  it('keeps the scope when the roast is in it, else shows every roaster', () => {
    expect(scopeShowing(ACTIVE, roast(1, 1), 1)).toBe(ACTIVE);
    expect(scopeShowing(ACTIVE, roast(3, 2), 1)).toBe(ALL_ROASTERS);
    expect(scopeShowing(NO_ROASTER, roast(4, null), 1)).toBe(NO_ROASTER);
  });
});

describe('roasterScopeOptions', () => {
  it('puts the active roaster first, the rest by name, then all, then no roaster, with counts', () => {
    expect(roasterScopeOptions(ROASTS, ROASTERS, 1)).toEqual([
      { value: ACTIVE, label: 'Skywalker', detail: '2 roasts' },
      { value: '3', label: 'Artisan box', detail: 'No roasts' },
      { value: '2', label: 'Simulator', detail: '1 roast' },
      { value: ALL_ROASTERS, label: 'All roasters', detail: '4 roasts' },
      { value: NO_ROASTER, label: 'No roaster', detail: '1 roast' },
    ]);
  });

  it('has no No roaster choice when every roast has one', () => {
    const values = roasterScopeOptions([roast(1, 1)], ROASTERS, 1).map((o) => o.value);
    expect(values).not.toContain(NO_ROASTER);
  });
});

describe('roasterOf and scopeName', () => {
  it('names a roast’s roaster, and the roaster a scope is of', () => {
    expect(roasterOf(roast(3, 2), ROASTERS)).toBe('Simulator');
    expect(roasterOf(roast(4, null), ROASTERS)).toBe('No roaster');
    expect(scopeName(ACTIVE, ROASTERS, 2)).toBe('Simulator');
    expect(scopeName('3', ROASTERS, 1)).toBe('Artisan box');
    expect(scopeName(ALL_ROASTERS, ROASTERS, 1)).toBeUndefined();
  });
});
