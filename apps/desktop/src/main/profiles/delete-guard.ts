import type { ProfileError, ProfileId } from '@roastpilot/shared';

/** Why a delete was refused: a built-in, or a profile Auto uses or runs. */
export type DeleteRefusal = Extract<ProfileError, { kind: 'built-in' | 'in-use' }>;

export interface DeleteGuard {
  isBuiltIn: (id: ProfileId) => boolean;
  /** The profile Auto uses (Settings) and the one it runs now; the same until Drop. */
  inUse: readonly ProfileId[];
}

/** Why deleting `ids` is refused as a whole, or undefined when every one may go. */
export function deleteRefusal(
  ids: readonly ProfileId[],
  { isBuiltIn, inUse }: DeleteGuard,
): DeleteRefusal | undefined {
  const builtIn = ids.find(isBuiltIn);
  if (builtIn !== undefined) return { kind: 'built-in', id: builtIn };
  const used = ids.find((id) => inUse.includes(id));
  return used === undefined ? undefined : { kind: 'in-use', id: used };
}
