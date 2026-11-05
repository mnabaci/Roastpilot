import type {
  AutoProfile,
  RoasterId,
  Result,
  RoastDetail,
  RoastId,
  RoastSummary,
  SavedEvent,
  SavedSample,
  StorageError,
} from '@roastpilot/shared';

/** What a saved roast row holds besides its samples and events; set as the roast goes on. */
export type RoastSummaryPatch = Partial<
  Pick<RoastSummary, 'endedAt' | 'fcTimeS' | 'dropTimeS' | 'dropTemp'>
>;

/** Saved roasts (docs/spec/data-model.md). Implemented in `storage`. */
export interface RoastRepository {
  create(roast: {
    startedAt: string;
    mode: 'manual' | 'auto';
    profile: AutoProfile | null;
    roasterId: RoasterId | null;
  }): Promise<Result<RoastId, StorageError>>;
  addSamples(id: RoastId, samples: readonly SavedSample[]): Promise<Result<void, StorageError>>;
  addEvent(id: RoastId, event: SavedEvent): Promise<Result<void, StorageError>>;
  update(id: RoastId, patch: RoastSummaryPatch): Promise<Result<void, StorageError>>;
  /** Newest first. */
  list(): Promise<Result<RoastSummary[], StorageError>>;
  get(id: RoastId): Promise<Result<RoastDetail, StorageError>>;
  /** Removes the roast with its samples and events. */
  delete(id: RoastId): Promise<Result<void, StorageError>>;
}
