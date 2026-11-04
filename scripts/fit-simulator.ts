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

interface SampleRow {
  t_s: number;
  values: string;
}

/** Saved channel values; anything missing counts as off. */
function outputs(json: string): {
  bt: number | undefined;
  heater: number;
  fan: number;
  cooling: number;
} {
  const values = JSON.parse(json) as Record<string, number | undefined>;
  return {
    bt: values.bt,
    heater: values.heater ?? 0,
    fan: values.fan ?? 0,
    cooling: values.cooling ?? 0,
  };
}

/** Beans are in from charge (t 0) until drop. */
function loadRoast(db: DatabaseSync, roastId: number): FitSample[] {
  const roast = db.prepare('SELECT drop_time_s FROM roasts WHERE id = ?').get(roastId) as
    { drop_time_s: number | null } | undefined;
  if (!roast) throw new Error(`Roast ${roastId} not found`);
  const dropS = roast.drop_time_s ?? Number.POSITIVE_INFINITY;
  const rows = db
    .prepare('SELECT t_s, "values" FROM roast_samples WHERE roast_id = ? ORDER BY t_s')
    .all(roastId) as unknown as SampleRow[];
  return rows.flatMap((row) => {
    const { bt, ...inputs } = outputs(row.values);
    return bt === undefined
      ? []
      : [{ tS: row.t_s, bt, beans: row.t_s >= 0 && row.t_s < dropS, ...inputs }];
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
process.stdout.write(
  `Roasts ${roastIds.join(', ')}: ${roasts.reduce((n, r) => n + r.length, 0)} readings\n` +
    `RMS error ${fit.errorBefore.toFixed(1)} °C → ${fit.errorAfter.toFixed(1)} °C\n` +
    `${JSON.stringify(report, null, 2)}\n`,
);
