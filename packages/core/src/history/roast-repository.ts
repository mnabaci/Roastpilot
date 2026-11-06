import type {
  AutoProfile,
  BeanId,
  RoastResult,
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

/** How a roast runs, read at charge. */
export interface RoastPlan {
  mode: 'manual' | 'auto';
  profile: AutoProfile | null;
  roasterId: RoasterId | null;
  beanId: BeanId | null;
  batchG: number | null;
  ghostRoastId: RoastId | null;
}

export interface NewRoast extends RoastPlan {
  startedAt: string;
}

/** Saved roasts (docs/spec/data-model.md). Implemented in `storage`. */
export interface RoastRepository {
  /** Makes the roast row and takes its batch off the bean's green stock. */
  create(roast: NewRoast): Promise<Result<RoastId, StorageError>>;
  /** What you say about the roast; stock moves only by what changed. */
  saveResult(result: RoastResult): Promise<Result<void, StorageError>>;
  addSamples(id: RoastId, samples: readonly SavedSample[]): Promise<Result<void, StorageError>>;
  addEvent(id: RoastId, event: SavedEvent): Promise<Result<void, StorageError>>;
  update(id: RoastId, patch: RoastSummaryPatch): Promise<Result<void, StorageError>>;
  /** Newest first. */
  list(): Promise<Result<RoastSummary[], StorageError>>;
  get(id: RoastId): Promise<Result<RoastDetail, StorageError>>;
  /** Removes the roast with its samples and events. */
  delete(id: RoastId): Promise<Result<void, StorageError>>;
}
