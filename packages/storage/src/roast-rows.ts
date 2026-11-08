import {
  AutoProfileSchema,
  SavedEventSchema,
  SavedSampleSchema,
  type AutoProfile,
  type SavedEvent,
  type SavedSample,
} from '@roastpilot/shared';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { parseJson } from './attempt';
import { roastEvents, roasts } from './schema/roasts';

/** BT at the roast's first event of `type`, from its JSON detail; null when unreadable or missing. */
const eventTemp = (type: 'first-crack' | 'turning-point') => sql<number | null>`(
  SELECT CASE WHEN json_valid(${roastEvents.detail}) THEN
    CASE WHEN json_type(${roastEvents.detail}, '$.bt') IN ('integer', 'real')
      THEN json_extract(${roastEvents.detail}, '$.bt') END
  END
  FROM ${roastEvents}
  WHERE ${roastEvents.roastId} = ${roasts.id} AND ${roastEvents.type} = ${type}
  ORDER BY ${roastEvents.tS}
  LIMIT 1
)`;

/** A roast's list columns, with its profile's id and name pulled from the JSON copy. */
export const summaryColumns = {
  id: roasts.id,
  startedAt: roasts.startedAt,
  endedAt: roasts.endedAt,
  fcTimeS: roasts.fcTimeS,
  fcTemp: eventTemp('first-crack'),
  tpTemp: eventTemp('turning-point'),
  dropTimeS: roasts.dropTimeS,
  dropTemp: roasts.dropTemp,
  roasterId: roasts.roasterId,
  beanId: roasts.beanId,
  ghostRoastId: roasts.ghostRoastId,
  batchG: roasts.batchG,
  roastedG: roasts.roastedG,
  rating: roasts.rating,
  isFavourite: roasts.isFavourite,
  notes: roasts.notes,
  profileId: sql<string | null>`json_extract(${roasts.profile}, '$.id')`,
  profileName: sql<string | null>`json_extract(${roasts.profile}, '$.name')`,
  imported: roasts.imported,
};

/** What stock changes need to know about a roast. */
export const stockColumns = {
  beanId: roasts.beanId,
  batchG: roasts.batchG,
  roastedG: roasts.roastedG,
  imported: roasts.imported,
};

/** A `roast_samples` row as read. */
export interface SampleRow {
  tS: number;
  values: string;
}

/** A `roast_events` row as read. */
export interface EventRow {
  tS: number;
  type: string;
  detail: string;
}

const EventDetailSchema = z.object({
  bt: z.number().nullable().catch(null),
  note: z.string().optional().catch(undefined),
});

/** The `detail` column of an event: its temperature and note. */
export function eventDetailJson(event: SavedEvent): string {
  return JSON.stringify({ bt: event.bt, note: event.detail });
}

/** Samples that parse; a row that doesn't is dropped, so the caller can count and log it. */
export function toSavedSamples(rows: readonly SampleRow[]): SavedSample[] {
  return rows.flatMap((row) => {
    const parsed = SavedSampleSchema.safeParse({ tS: row.tS, values: parseJson(row.values) });
    return parsed.success ? [parsed.data] : [];
  });
}

/** Events that parse; an unreadable detail only loses its temperature and note. */
export function toSavedEvents(rows: readonly EventRow[]): SavedEvent[] {
  return rows.flatMap((row) => {
    const detail = EventDetailSchema.safeParse(parseJson(row.detail));
    const parsed = SavedEventSchema.safeParse({
      kind: row.type,
      tS: row.tS,
      bt: detail.success ? detail.data.bt : null,
      ...(detail.success && detail.data.note !== undefined ? { detail: detail.data.note } : {}),
    });
    return parsed.success ? [parsed.data] : [];
  });
}

/** The profile copy of an Auto roast: null when there is none, undefined when it doesn't parse. */
export function toSavedProfile(json: string | null): AutoProfile | null | undefined {
  if (json === null) return null;
  const parsed = AutoProfileSchema.safeParse(parseJson(json));
  return parsed.success ? parsed.data : undefined;
}
