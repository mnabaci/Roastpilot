import {
  err,
  FileBeanSchema,
  ok,
  type Bean,
  type FileBean,
  type ProfileEntry,
  type LibraryItemId,
  type ProfileId,
} from '@roastpilot/shared';
import type { BeanService } from '../beans/bean-service';
import type { ProfileService } from '../profiles/profile-service';
import type { LibraryCodec } from './library-kind';
import { problemOf } from './problem-of';

/** The longest bean name (BeanFieldsSchema). */
const MAX_BEAN_NAME = 120;

/** The bean as a file carries it: its fields and its profile's name, not its stock. */
const toFile = (bean: Bean, profileNames: ReadonlyMap<ProfileId, string>): FileBean =>
  FileBeanSchema.parse({
    ...bean,
    profileName: bean.profileId === null ? null : (profileNames.get(bean.profileId) ?? null),
  });

/** The id of the active roaster's profile with exactly this name, built-ins first. */
const profileIdByName = (entries: readonly ProfileEntry[], name: string | null) =>
  name === null ? null : (entries.find((e) => e.profile.name === name)?.profile.id ?? null);

/**
 * Beans in Roastpilot files (docs/spec/data-model.md, Beans, profiles and roasters files): an
 * imported bean starts with 0 g, not archived, its profile linked by name among the active
 * roaster's, else none.
 */
export function beanCodec({
  beans,
  profiles,
}: {
  beans: Pick<BeanService, 'read' | 'addAll'>;
  profiles: Pick<ProfileService, 'list' | 'allNames'>;
}): LibraryCodec<FileBean> {
  const here = async (ids?: readonly LibraryItemId[]) => {
    const read = await beans.read();
    if (!read.ok) return read;
    const names = await profiles.allNames();
    const chosen = ids ? read.value.filter((bean) => ids.includes(bean.id)) : read.value;
    return ok(chosen.map((bean) => toFile(bean, names)));
  };
  return {
    exportItems: here,
    here: () => here(),
    readItem: (item) => {
      const parsed = FileBeanSchema.safeParse(item);
      return parsed.success ? ok(parsed.data) : err(problemOf(parsed.error));
    },
    // The profile link follows whatever is on this computer, so it doesn't make a bean differ.
    contentOf: ({ profileName: _profileName, ...fields }) => fields,
    nameOf: (bean) => bean.name,
    withName: (bean, name) => ({ ...bean, name }),
    maxName: MAX_BEAN_NAME,
    addAll: async (items) => {
      const entries = await profiles.list();
      return beans.addAll(
        items.map(({ profileName, ...fields }) => ({
          fields,
          profileId: profileIdByName(entries, profileName),
        })),
      );
    },
  };
}
