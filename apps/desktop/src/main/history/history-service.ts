import type { Logger, RoastRepository } from '@roastpilot/core';
import {
  err,
  type DeleteRoastError,
  type Result,
  type RoastDetail,
  type RoastId,
  type RoastSummary,
  type StorageError,
} from '@roastpilot/shared';

export interface HistoryServiceDeps {
  repository: Pick<RoastRepository, 'list' | 'get' | 'delete'>;
  /** The roast being saved right now can't be deleted. */
  isRecording: (id: RoastId) => boolean;
  /** A roast was deleted: tell the windows. */
  onDeleted: (id: RoastId) => void;
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
}
