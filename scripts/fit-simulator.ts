// Refits the simulator's thermal constants to saved roasts (docs/spec/hardware.md, Simulator):
// replays each roast's heater, fan and cooling through the model and searches for the constants
// whose bean temperature matches the readings best (least squares). Prints them for
// DEFAULT_THERMAL_CONSTANTS; reads the database read-only.
//
// Run with: pnpm fit:simulator <roast id>... [--db <path to roastpilot.db>]
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseArgs } from 'node:util';
import { DEFAULT_THERMAL_CONSTANTS } from '../packages/drivers/src/simulated/thermal-model';
import {
  BEANS_IN_ONLY,
  EVERY_READING,
  fitError,
  fitThermalConstants,
  FITTED_KEYS,
  type FitSample,
} from '../packages/drivers/src/simulated/thermal-fit';

/** Where Electron keeps the app's data (app.getPath('userData')) on each platform. */
function defaultDbPath(): string {
  const base =
    process.platform === 'win32'
      ? (process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
      : join(homedir(), 'Library', 'Application Support');
  return join(base, 'Roastpilot', 'roastpilot.db');
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A saved sample's channel values (JSON); anything missing or not a number counts as off. */
function sampleValues(json: string): {
  bt: number | undefined;
  heater: number;
  fan: number;
  cooling: number;
} {
  const parsed: unknown = JSON.parse(json);
  const values =
    typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const channel = (name: string) => (isNumber(values[name]) ? values[name] : undefined);
  return {
    bt: channel('bt'),
    heater: channel('heater') ?? 0,
    fan: channel('fan') ?? 0,
    cooling: channel('cooling') ?? 0,
  };
}

/** Beans are in from charge (t 0) until drop. */
function loadRoast(db: DatabaseSync, roastId: number): FitSample[] {
  const roast = db.prepare('SELECT drop_time_s FROM roasts WHERE id = ?').get(roastId);
  if (!roast) throw new Error(`Roast ${roastId} not found`);
  const dropS = isNumber(roast.drop_time_s) ? roast.drop_time_s : Number.POSITIVE_INFINITY;
  const rows = db
    .prepare('SELECT t_s, "values" FROM roast_samples WHERE roast_id = ? ORDER BY t_s')
    .all(roastId);
  return rows.flatMap((row) => {
    const tS = row.t_s;
    if (!isNumber(tS) || typeof row.values !== 'string') return [];
    const { bt, ...inputs } = sampleValues(row.values);
    return bt === undefined ? [] : [{ tS, bt, beans: tS >= 0 && tS < dropS, ...inputs }];
  });
}

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { db: { type: 'string', default: defaultDbPath() } },
});
const roastIds = positionals.map(Number);
if (roastIds.length === 0 || roastIds.some((id) => !Number.isInteger(id))) {
  throw new Error('Usage: pnpm fit:simulator <roast id>... [--db <path>]');
}

const db = new DatabaseSync(options.db, { readOnly: true });
const roasts = roastIds.map((id) => loadRoast(db, id));
db.close();

const fit = fitThermalConstants(roasts, DEFAULT_THERMAL_CONSTANTS);
const report = Object.fromEntries(
  FITTED_KEYS.map((key) => [key, Number(fit.constants[key].toPrecision(3))]),
);
const rms = (label: string, weights: typeof EVERY_READING) =>
  `${label} ${fitError(roasts, DEFAULT_THERMAL_CONSTANTS, weights).toFixed(1)} °C → ` +
  `${fitError(roasts, fit.constants, weights).toFixed(1)} °C\n`;
process.stdout.write(
  `Roasts ${roastIds.join(', ')}: ${roasts.reduce((n, r) => n + r.length, 0)} readings\n` +
    `RMS error (fitted, beans in ×20) ${fit.errorBefore.toFixed(1)} °C → ${fit.errorAfter.toFixed(1)} °C\n` +
    rms('RMS charge to drop', BEANS_IN_ONLY) +
    rms('RMS every reading', EVERY_READING) +
    `${JSON.stringify(report, null, 2)}\n`,
);
