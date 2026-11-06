import { err, ok, type Result, type SavedEvent, type SavedSample } from '@roastpilot/shared';
import { parsePythonLiteral } from './python-literal';

/** A roast read from an Artisan `.alog`, in Roastpilot's terms: °C, grams, seconds from charge. */
export interface ArtisanRoast {
  startedAt: string;
  endedAt: string;
  fcTimeS: number | null;
  dropTimeS: number | null;
  dropTemp: number | null;
  batchG: number | null;
  roastedG: number | null;
  notes: string;
  samples: SavedSample[];
  events: SavedEvent[];
}

/** Positions in Artisan's `timeindex`. Charge is -1 when unset, the others 0. */
const SLOT = { charge: 0, dryEnd: 1, firstCrack: 2, drop: 6, coolEnd: 7 } as const;
const GRAMS_PER: Readonly<Record<string, number>> = { g: 1, kg: 1000, lb: 453.592, oz: 28.3495 };
const MAX_NOTES = 4000;

const numbersIn = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => typeof v === 'number') ? value : undefined;

const textIn = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const round = (value: number, places: number) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

/** Artisan writes -1 for a reading it doesn't have. */
const isReading = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value !== -1;

function startMs(file: Record<string, unknown>): number | undefined {
  if (typeof file.roastepoch === 'number' && file.roastepoch > 0) return file.roastepoch * 1000;
  const date = textIn(file.roastisodate);
  const parsed = Date.parse(`${date}T${textIn(file.roasttime) || '00:00:00'}`);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function weightG(file: Record<string, unknown>): {
  batchG: number | null;
  roastedG: number | null;
} {
  const weight = Array.isArray(file.weight) ? (file.weight as unknown[]) : [];
  const grams = GRAMS_PER[textIn(weight[2]).toLowerCase()];
  const read = (value: unknown) =>
    grams !== undefined && typeof value === 'number' && value > 0 ? round(value * grams, 1) : null;
  return { batchG: read(weight[0]), roastedG: read(weight[1]) };
}

/** The roast in an `.alog`'s text, or why it isn't one. */
export function parseArtisan(text: string): Result<ArtisanRoast, string> {
  let file: unknown;
  try {
    file = parsePythonLiteral(text);
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Unreadable file');
  }
  if (typeof file !== 'object' || file === null || Array.isArray(file)) return err('Not a roast');
  const roast = file as Record<string, unknown>;
  const times = numbersIn(roast.timex);
  const beanTemps = numbersIn(roast.temp2);
  if (!times || !beanTemps) return err('No timex or temp2');
  const envTemps = numbersIn(roast.temp1) ?? [];
  const index = numbersIn(roast.timeindex) ?? [];

  const celsius = (value: number) => round(roast.mode === 'F' ? ((value - 32) * 5) / 9 : value, 1);
  const chargeIndex = index[SLOT.charge] ?? -1;
  const chargeAt = times[chargeIndex] ?? 0;
  const secondsAt = (i: number) => round((times[i] ?? 0) - chargeAt, 3);

  const samples: SavedSample[] = [];
  times.forEach((_, i) => {
    const bt = beanTemps[i];
    if (!isReading(bt)) return;
    const et = envTemps[i];
    samples.push({
      tS: secondsAt(i),
      values: { bt: celsius(bt), ...(isReading(et) ? { et: celsius(et) } : {}) },
    });
  });
  const lastSample = samples.at(-1);
  if (!lastSample) return err('No temperatures');

  const began = startMs(roast);
  if (began === undefined) return err('No roast date');
  const startedMs = began + chargeAt * 1000;

  const event = (kind: SavedEvent['kind'], i: number): SavedEvent => {
    const bt = beanTemps[i];
    return { kind, tS: secondsAt(i), bt: isReading(bt) ? celsius(bt) : null };
  };
  const slot = (name: Exclude<keyof typeof SLOT, 'charge'>) => {
    const i = index[SLOT[name]];
    return i !== undefined && i > 0 && i < times.length ? i : undefined;
  };
  const named = (kind: SavedEvent['kind'], i: number | undefined) =>
    i === undefined ? [] : [event(kind, i)];
  const dropEvent = named('drop', slot('drop'))[0];
  const coolEvent = named('cool-end', slot('coolEnd'))[0];
  const events = [
    ...(chargeIndex >= 0 && chargeIndex < times.length ? [event('charge', chargeIndex)] : []),
    ...named('dry-end', slot('dryEnd')),
    ...named('first-crack', slot('firstCrack')),
    ...(dropEvent ? [dropEvent] : []),
    ...(coolEvent ? [coolEvent] : []),
  ];

  const said = [textIn(roast.title), textIn(roast.beans), textIn(roast.roastingnotes)];
  return ok({
    startedAt: new Date(startedMs).toISOString(),
    // An imported roast is finished, however its file ends.
    endedAt: new Date(
      startedMs + (coolEvent?.tS ?? dropEvent?.tS ?? lastSample.tS) * 1000,
    ).toISOString(),
    fcTimeS: events.find((e) => e.kind === 'first-crack')?.tS ?? null,
    dropTimeS: dropEvent?.tS ?? null,
    dropTemp: dropEvent?.bt ?? null,
    ...weightG(roast),
    notes: ['Imported from Artisan', ...said.filter(Boolean)].join(' · ').slice(0, MAX_NOTES),
    samples,
    events,
  });
}
