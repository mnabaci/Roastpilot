import type { Result, Settings, SettingsWriteError } from '@roastpilot/shared';

/** Where settings live: a JSON file now, roaster records in SQLite later (docs/spec/ui.md, Settings). */
export interface SettingsStore {
  /** Never fails: a missing or broken store gives the defaults. */
  load(): Promise<Settings>;
  save(settings: Settings): Promise<Result<void, SettingsWriteError>>;
}
