import type { Logger, RoastRepository } from '@roastpilot/core';
import {
  err,
  ok,
  type DeleteRoastError,
  type ImportArtisanError,
  type Result,
  type RoastDetail,
  type RoastId,
  type RoastResult,
  type RoastSummary,
  type StorageError,
} from '@roastpilot/shared';
import { parseArtisan } from './artisan-import';
import { fillOrRemove } from './fill-roast';
import { roastsToCsv } from './roast-csv';

export interface HistoryServiceDeps {
  repository: Pick<
    RoastRepository,
    | 'list'
    | 'get'
    | 'delete'
    | 'saveResult'
    | 'create'
    | 'addSamples'
    | 'addEvent'
    | 'update'
    | 'setBean'
  >;
  /** Bean names by id, for the CSV. */
  beanNames: () => Promise<ReadonlyMap<number, string>>;
  /** The roast being saved right now can't be deleted. */
  isRecording: (id: RoastId) => boolean;
  /** A roast was deleted: tell the windows. */
  onDeleted: (id: RoastId) => void;
  /** What you said about a roast was saved: its row and the bean's stock moved. */
  onResultSaved: (id: RoastId) => void;
  logger: Logger;
}

/** What the History screen asks for (docs/spec/ui.md, History screen). Failures are logged here. */
export class HistoryService {
  readonly #deps: HistoryServiceDeps;

  constructor(deps: HistoryServiceDeps) {
    this.#deps = deps;
  }

  /** Newest first; empty when storage can't be read, so the screen still opens. */
  async list(): Promise<RoastSummary[]> {
    const listed = await this.#deps.repository.list();
    if (listed.ok) return listed.value;
    this.#deps.logger.error('history.list-failed', { error: listed.error });
    return [];
  }

  async get(id: RoastId): Promise<Result<RoastDetail, StorageError>> {
    const read = await this.#deps.repository.get(id);
    if (!read.ok) this.#deps.logger.warn('history.get-failed', { id, error: read.error });
    return read;
  }

  async saveResult(result: RoastResult): Promise<Result<void, StorageError>> {
    const saved = await this.#deps.repository.saveResult(result);
    if (saved.ok) {
      this.#deps.logger.info('history.result-saved', { id: result.id });
      this.#deps.onResultSaved(result.id);
    } else {
      this.#deps.logger.warn('history.result-failed', { id: result.id, error: saved.error });
    }
    return saved;
  }

  async delete(id: RoastId): Promise<Result<void, DeleteRoastError>> {
    if (this.#deps.isRecording(id)) {
      this.#deps.logger.warn('history.delete-refused', { id, reason: 'in-progress' });
      return err({ kind: 'in-progress', id });
    }
    const deleted = await this.#deps.repository.delete(id);
    if (!deleted.ok) {
      this.#deps.logger.warn('history.delete-failed', { id, error: deleted.error });
      return deleted;
    }
    this.#deps.logger.info('history.deleted', { id });
    this.#deps.onDeleted(id);
    return deleted;
  }

  /** Every roast as CSV, or only the ones named. */
  async exportCsv(ids?: readonly RoastId[]): Promise<Result<string, StorageError>> {
    const listed = await this.#deps.repository.list();
    if (!listed.ok) {
      this.#deps.logger.warn('history.export-failed', { error: listed.error });
      return listed;
    }
    const chosen = ids ? listed.value.filter((r) => ids.includes(r.id)) : listed.value;
    return ok(roastsToCsv(chosen, await this.#deps.beanNames()));
  }

  /** Links a saved roast to a bean, or none; stock as the repository says. */
  async setBean(id: RoastId, beanId: number | null): Promise<Result<void, StorageError>> {
    const set = await this.#deps.repository.setBean(id, beanId);
    if (!set.ok) {
      this.#deps.logger.warn('history.set-bean-failed', { id, error: set.error });
      return set;
    }
    this.#deps.logger.info('history.bean-set', { id, beanId });
    this.#deps.onResultSaved(id);
    return set;
  }

  /** Saves the roast in an `.alog`'s text as a new one, or nothing at all if a write fails. */
  async importArtisan(text: string): Promise<Result<RoastId, ImportArtisanError>> {
    const parsed = parseArtisan(text);
    if (!parsed.ok) {
      this.#deps.logger.warn('history.import-refused', { reason: parsed.error });
      return err({ kind: 'not-artisan' });
    }
    const roast = parsed.value;
    const { repository, logger } = this.#deps;
    const created = await repository.create({
      startedAt: roast.startedAt,
      mode: 'manual',
      profile: null,
      roasterId: null,
      beanId: null,
      batchG: roast.batchG,
      ghostRoastId: null,
      imported: true,
    });
    if (!created.ok) {
      logger.warn('history.import-failed', { error: created.error });
      return created;
    }
    const id = created.value;
    const filled = await fillOrRemove(repository, id, roast, logger);
    if (!filled.ok) {
      logger.warn('history.import-failed', { id, error: filled.error });
      return filled;
    }
    logger.info('history.imported', { id, samples: roast.samples.length });
    this.#deps.onResultSaved(id);
    return ok(id);
  }
}
