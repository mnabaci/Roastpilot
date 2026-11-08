import {
  err,
  fileFieldsOf,
  FileBeanSchema,
  ok,
  type Bean,
  type FileBean,
  type ProfileEntry,
  type ProfileId,
  type Result,
  type StorageError,
} from '@roastpilot/shared';
import type { BeanService } from '../beans/bean-service';
import type { ProfileService } from '../profiles/profile-service';
import type { LibraryCodec } from './library-kind';
import { problemOf } from './problem-of';

/** The longest bean name (BeanFieldsSchema). */
const MAX_BEAN_NAME = 120;

/** The bean as a file carries it: its fields and its profile's name, not its stock. */
const toFile = (bean: Bean, profileNames: ReadonlyMap<ProfileId, string>): FileBean =>
  fileFieldsOf(FileBeanSchema, {
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
  profileNames,
}: {
  beans: Pick<BeanService, 'read' | 'addAll'>;
  profiles: Pick<ProfileService, 'list'>;
  /** Every profile's name by id, on any roaster (allProfileNames). */
  profileNames: () => Promise<Result<ReadonlyMap<ProfileId, string>, StorageError>>;
}): LibraryCodec<FileBean> {
  /** Every bean as `Bean` and as the file carries it. */
  const read = async () => {
    const all = await beans.read();
    if (!all.ok) return all;
    const names = await profileNames();
    if (!names.ok) return names;
    return ok(all.value.map((bean) => ({ bean, file: toFile(bean, names.value) })));
  };
  return {
    exportItems: async (ids) => {
      const all = await read();
      if (!all.ok) return all;
      const chosen = ids ? all.value.filter(({ bean }) => ids.includes(bean.id)) : all.value;
      return ok(chosen.map(({ file }) => file));
    },
    here: async () => {
      const all = await read();
      if (!all.ok) return all;
      const files = (archived: boolean) =>
        all.value.filter(({ bean }) => bean.archived === archived).map(({ file }) => file);
      return ok({ items: files(false), archived: files(true) });
    },
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
