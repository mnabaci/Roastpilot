import type { Roaster, RoastSummary } from '@roastpilot/shared';
import type { SelectOption } from '@roastpilot/ui';

/** Whichever roaster is active: History follows it as you switch roasters. */
export const ACTIVE = 'active';
export const ALL_ROASTERS = 'all';
/** Roasts with no roaster: brought in from Artisan, or from a file that named none. */
export const NO_ROASTER = 'none';

/** Which roaster's roasts History lists: `active`, `all`, `none` or a roaster's id. */
export type RoasterScope = string;

type RoasterName = Pick<Roaster, 'id' | 'name'>;

/** A roaster's id as its own choice, or `active` for the active one, so the choice follows it. */
const scopeOfId = (id: number, activeId: number | undefined): RoasterScope =>
  id === activeId ? ACTIVE : String(id);

/**
 * Whether there is a roaster to choose: more than one roaster, or roasts with none. With one
 * roaster and no imports, every roast is its, and History doesn't say so.
 */
export const hasRoasterScope = (
  roasters: readonly unknown[],
  roasts: readonly Pick<RoastSummary, 'roasterId'>[],
): boolean => roasters.length > 1 || roasts.some((r) => r.roasterId === null);

/** The same choice said one way: the active roaster's id is `active`. */
export const normalScope = (scope: RoasterScope, activeId: number | undefined): RoasterScope =>
  scope !== ACTIVE && scope === String(activeId) ? ACTIVE : scope;

/** Whether a roast is in the scope. With no active roaster yet, `active` is every roast. */
function inScope(
  roast: Pick<RoastSummary, 'roasterId'>,
  scope: RoasterScope,
  activeId: number | undefined,
): boolean {
  switch (scope) {
    case ALL_ROASTERS:
      return true;
    case NO_ROASTER:
      return roast.roasterId === null;
    case ACTIVE:
      return activeId === undefined || roast.roasterId === activeId;
    default:
      return String(roast.roasterId) === scope;
  }
}

/** The roasts in the scope, in their order. */
export const roastsInScope = <R extends Pick<RoastSummary, 'roasterId'>>(
  roasts: readonly R[],
  scope: RoasterScope,
  activeId: number | undefined,
): R[] => roasts.filter((r) => inScope(r, scope, activeId));

/** The scope to show a roast you asked for: as it is when the roast is in it, else every roaster. */
export const scopeShowing = (
  scope: RoasterScope,
  roast: Pick<RoastSummary, 'roasterId'>,
  activeId: number | undefined,
): RoasterScope => (inScope(roast, scope, activeId) ? scope : ALL_ROASTERS);

const count = (n: number) =>
  n === 0 ? 'No roasts' : `${String(n)} ${n === 1 ? 'roast' : 'roasts'}`;

/**
 * The choices: the active roaster first, then the others by name, then All roasters, then No
 * roaster when some roasts have none; each with how many roasts it has.
 */
export function roasterScopeOptions(
  roasts: readonly Pick<RoastSummary, 'roasterId'>[],
  roasters: readonly RoasterName[],
  activeId: number | undefined,
): SelectOption<RoasterScope>[] {
  const on = (scope: RoasterScope) => count(roastsInScope(roasts, scope, activeId).length);
  const active = roasters.find((r) => r.id === activeId);
  const others = roasters
    .filter((r) => r.id !== activeId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const unowned = roasts.some((r) => r.roasterId === null);
  return [
    ...(active ? [{ value: ACTIVE, label: active.name, detail: on(ACTIVE) }] : []),
    ...others.map((r) => {
      const scope = scopeOfId(r.id, activeId);
      return { value: scope, label: r.name, detail: on(scope) };
    }),
    { value: ALL_ROASTERS, label: 'All roasters', detail: on(ALL_ROASTERS) },
    ...(unowned ? [{ value: NO_ROASTER, label: 'No roaster', detail: on(NO_ROASTER) }] : []),
  ];
}

/** What a roast's row says it ran on while several roasters' roasts show. */
export const roasterOf = (
  roast: Pick<RoastSummary, 'roasterId'>,
  roasters: readonly RoasterName[],
): string =>
  roast.roasterId === null
    ? 'No roaster'
    : (roasters.find((r) => r.id === roast.roasterId)?.name ?? 'Another roaster');

/** The name the empty list says: "No roasts on Simulator yet". */
export const scopeName = (
  scope: RoasterScope,
  roasters: readonly RoasterName[],
  activeId: number | undefined,
): string | undefined => {
  const id = scope === ACTIVE ? activeId : Number(scope);
  return roasters.find((r) => r.id === id)?.name;
};
