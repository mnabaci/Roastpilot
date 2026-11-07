import type { Logger, RoastRepository } from '@roastpilot/core';
import type { Result, RoastId, SavedEvent, SavedSample, StorageError } from '@roastpilot/shared';

/** A finished roast from a file, to write into a row that was just made. */
export interface RoastToFill {
  samples: readonly SavedSample[];
  events: readonly SavedEvent[];
  endedAt: string | null;
  fcTimeS: number | null;
  dropTimeS: number | null;
  dropTemp: number | null;
  batchG: number | null;
  roastedG: number | null;
  notes: string | null;
  rating?: number | null;
  isFavourite?: boolean;
}

/** Writes an imported roast's samples, events, timings and result; stops at the first failure. */
export async function fillRoast(
  repository: Pick<RoastRepository, 'addSamples' | 'addEvent' | 'update' | 'saveResult'>,
  id: RoastId,
  roast: RoastToFill,
): Promise<Result<void, StorageError>> {
  const samples = await repository.addSamples(id, roast.samples);
  if (!samples.ok) return samples;
  for (const event of roast.events) {
    const added = await repository.addEvent(id, event);
    if (!added.ok) return added;
  }
  const updated = await repository.update(id, {
    endedAt: roast.endedAt,
    fcTimeS: roast.fcTimeS,
    dropTimeS: roast.dropTimeS,
    dropTemp: roast.dropTemp,
  });
  if (!updated.ok) return updated;
  return repository.saveResult({
    id,
    batchG: roast.batchG,
    roastedG: roast.roastedG,
    rating: roast.rating ?? null,
    isFavourite: roast.isFavourite ?? false,
    notes: roast.notes,
  });
}

/**
 * `fillRoast`, and on a failure the half-written row is deleted again, so an import leaves all or
 * nothing. A delete that fails too is logged: that row stays, visible in History.
 */
export async function fillOrRemove(
  repository: Pick<RoastRepository, 'addSamples' | 'addEvent' | 'update' | 'saveResult' | 'delete'>,
  id: RoastId,
  roast: RoastToFill,
  logger: Logger,
): Promise<Result<void, StorageError>> {
  const filled = await fillRoast(repository, id, roast);
  if (filled.ok) return filled;
  const removed = await repository.delete(id);
  if (!removed.ok) logger.error('history.import-cleanup-failed', { id, error: removed.error });
  return filled;
}
