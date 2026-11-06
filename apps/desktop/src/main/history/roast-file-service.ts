import type { Logger, RoastRepository } from '@roastpilot/core';
import {
  err,
  ok,
  type ImportRoastsError,
  type Result,
  type RoastDetail,
  type RoastId,
  type StorageError,
} from '@roastpilot/shared';
import { fillRoast } from './fill-roast';
import { idByName, parseRoastFile, toRoastFile, type Names } from './roast-file';

export interface RoastFileServiceDeps {
  repository: Pick<
    RoastRepository,
    'list' | 'get' | 'create' | 'addSamples' | 'addEvent' | 'update' | 'saveResult' | 'delete'
  >;
  /** Bean and roaster names by id: written into files, and matched on import. */
  names: () => Promise<Names>;
  /** A roast came in: tell the windows. */
  onAdded: (id: RoastId) => void;
  now: () => Date;
  logger: Logger;
}

/** Roastpilot roast files in and out (docs/spec/data-model.md, Roastpilot roast files). */
export class RoastFileService {
  readonly #deps: RoastFileServiceDeps;

  constructor(deps: RoastFileServiceDeps) {
    this.#deps = deps;
  }

  /** Every roast in full, or only the ones named, as a file's text. */
  async exportFile(ids?: readonly RoastId[]): Promise<Result<string, StorageError>> {
    const { repository, logger } = this.#deps;
    const listed = await repository.list();
    if (!listed.ok) {
      logger.warn('history.export-failed', { error: listed.error });
      return listed;
    }
    const chosen = ids ? listed.value.filter((r) => ids.includes(r.id)) : listed.value;
    const details: RoastDetail[] = [];
    for (const summary of chosen) {
      const read = await repository.get(summary.id);
      if (!read.ok) {
        logger.warn('history.export-failed', { id: summary.id, error: read.error });
        return read;
      }
      details.push(read.value);
    }
    const file = toRoastFile(details, await this.#deps.names(), this.#deps.now());
    logger.info('history.exported', { roasts: details.length });
    return ok(JSON.stringify(file, null, 2));
  }

  /**
   * Adds the file's roasts that aren't in History yet (same start time) and counts both. Each one
   * goes in whole or not at all; a failure stops there, keeping those already added.
   */
  async importFile(
    text: string,
  ): Promise<Result<{ added: number; skipped: number }, ImportRoastsError>> {
    const { repository, logger } = this.#deps;
    const parsed = parseRoastFile(text);
    if (!parsed.ok) {
      logger.warn('history.import-refused', { reason: parsed.error });
      return err({ kind: parsed.error });
    }
    const listed = await repository.list();
    if (!listed.ok) {
      logger.warn('history.import-failed', { error: listed.error });
      return listed;
    }
    const here = new Set(listed.value.map((r) => r.startedAt));
    const names = await this.#deps.names();
    let added = 0;
    let skipped = 0;
    for (const roast of parsed.value) {
      if (here.has(roast.startedAt)) {
        skipped += 1;
        continue;
      }
      const created = await repository.create({
        startedAt: roast.startedAt,
        mode: roast.mode,
        profile: roast.profile,
        // Linked only by exact name; never to stock (it was roasted elsewhere).
        roasterId: idByName(names.roasters, roast.roasterName),
        beanId: idByName(names.beans, roast.beanName),
        batchG: roast.batchG,
        ghostRoastId: null,
        imported: true,
      });
      if (!created.ok) {
        logger.warn('history.import-failed', { added, error: created.error });
        return created;
      }
      const filled = await fillRoast(repository, created.value, roast);
      if (!filled.ok) {
        logger.warn('history.import-failed', { added, error: filled.error });
        await repository.delete(created.value);
        return filled;
      }
      here.add(roast.startedAt);
      added += 1;
      this.#deps.onAdded(created.value);
    }
    logger.info('history.imported', { added, skipped });
    return ok({ added, skipped });
  }
}
