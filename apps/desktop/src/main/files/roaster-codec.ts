import {
  err,
  fileFieldsOf,
  FileRoasterFieldsSchema,
  FileRoasterSchema,
  ok,
  type FileRoaster,
  type LibraryItemId,
} from '@roastpilot/shared';
import type { RoasterService } from '../roasters/roaster-service';
import { asStorageError, type LibraryCodec } from './library-kind';
import { problemOf } from './problem-of';

/** The longest roaster name (RoasterSchema). */
const MAX_ROASTER_NAME = 64;

/**
 * Roaster records in Roastpilot files (docs/spec/data-model.md, Beans, profiles and roasters
 * files): no port, which belongs to one computer, and never active, so an imported Skywalker
 * asks for its port on Connect.
 */
export function roasterCodec({
  roasters,
}: {
  roasters: Pick<RoasterService, 'all' | 'addAll'>;
}): LibraryCodec<FileRoaster> {
  // Only what a file carries: no id, port or active flag.
  const listed = (ids?: readonly LibraryItemId[]) =>
    roasters.all
      .filter((roaster) => !ids || ids.includes(roaster.id))
      .map((roaster) => fileFieldsOf(FileRoasterFieldsSchema, roaster));
  return {
    exportItems: (ids) => Promise.resolve(ok(listed(ids))),
    here: () => Promise.resolve(ok({ items: listed(), archived: [] })),
    readItem: (item) => {
      const parsed = FileRoasterSchema.safeParse(item);
      return parsed.success ? ok(parsed.data) : err(problemOf(parsed.error));
    },
    contentOf: ({ name: _name, ...record }) => record,
    nameOf: (roaster) => roaster.name,
    withName: (roaster, name) => ({ ...roaster, name }),
    maxName: MAX_ROASTER_NAME,
    addAll: async (items) => {
      const added = await roasters.addAll(
        items.map((record) => ({ ...record, connection: null, active: false })),
      );
      return added.ok
        ? ok(added.value.map((roaster) => roaster.id))
        : err(asStorageError(added.error));
    },
  };
}
