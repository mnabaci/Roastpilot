import {
  err,
  fileFieldsOf,
  FileProfileFieldsSchema,
  FileProfileSchema,
  ok,
  overRoasterLimits,
  type FileProfile,
  type LibraryItemId,
  type Roaster,
} from '@roastpilot/shared';
import type { ProfileService } from '../profiles/profile-service';
import { asStorageError, type LibraryCodec } from './library-kind';
import { problemOf } from './problem-of';

/** A profile name has no limit of its own. */
const NO_NAME_LIMIT = Number.POSITIVE_INFINITY;

/**
 * Profiles in Roastpilot files (docs/spec/data-model.md, Beans, profiles and roasters files): an
 * imported one joins the active roaster's profiles marked "needs calibration", as a copy to
 * another roaster is, after the same checks as Save and the active roaster's limits.
 */
export function profileCodec({
  profiles,
  activeRoaster,
  newId,
}: {
  profiles: Pick<ProfileService, 'list' | 'addAll'>;
  activeRoaster: () => Pick<Roaster, 'maxTempC' | 'maxTimeS'>;
  newId: () => string;
}): LibraryCodec<FileProfile> {
  // Only what a file carries: no id, no source.
  const listed = async (ids?: readonly LibraryItemId[]) =>
    (await profiles.list())
      .map((entry) => entry.profile)
      .filter((profile) => !ids || ids.includes(profile.id))
      .map((profile) => fileFieldsOf(FileProfileFieldsSchema, profile));
  return {
    exportItems: async (ids) => ok(await listed(ids)),
    here: async () => ok({ items: await listed(), archived: [] }),
    readItem: (item) => {
      const parsed = FileProfileSchema.safeParse(item);
      if (!parsed.success) return err(problemOf(parsed.error));
      const over = overRoasterLimits(parsed.data, activeRoaster());
      return over === undefined ? ok(parsed.data) : err(over);
    },
    // Every import comes in needing calibration, so that alone doesn't make a profile differ.
    contentOf: ({ name: _name, needsCalibration: _calibration, ...plan }) => plan,
    nameOf: (profile) => profile.name,
    withName: (profile, name) => ({ ...profile, name }),
    maxName: NO_NAME_LIMIT,
    addAll: async (items) => {
      const added = items.map((profile) => ({ ...profile, id: newId(), needsCalibration: true }));
      const saved = await profiles.addAll(added);
      return saved.ok ? ok(added.map((profile) => profile.id)) : err(asStorageError(saved.error));
    },
  };
}
