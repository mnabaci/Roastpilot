import type { Logger, ProfileRepository } from '@roastpilot/core';
import { SKYWALKER_PROFILES } from '@roastpilot/drivers';
import {
  DEFAULT_PROFILE_ID,
  err,
  ok,
  type AutoProfile,
  type ProfileEntry,
  type ProfileError,
  type ProfileId,
  type Result,
} from '@roastpilot/shared';

const BUILT_INS: readonly AutoProfile[] = Object.values(SKYWALKER_PROFILES);
const isBuiltIn = (id: ProfileId) => BUILT_INS.some((profile) => profile.id === id);

export interface ProfileServiceDeps {
  store: ProfileRepository;
  newId: () => string;
  /** The profile chosen in Settings. */
  chosenId: () => ProfileId;
  logger: Logger;
}

/** Built-ins and your own profiles as one list; Auto reads the choice from memory on every tick. */
export class ProfileService {
  readonly #deps: ProfileServiceDeps;
  #own: AutoProfile[] = [];

  constructor(deps: ProfileServiceDeps) {
    this.#deps = deps;
  }

  /** The profile Auto runs: the chosen one, or the default when it is gone. */
  active(): AutoProfile {
    const all = [...BUILT_INS, ...this.#own];
    const chosen = all.find((profile) => profile.id === this.#deps.chosenId());
    return chosen ?? SKYWALKER_PROFILES[DEFAULT_PROFILE_ID];
  }

  /** Reads your own from storage. Built-ins alone, logged, when it can't. */
  async list(): Promise<ProfileEntry[]> {
    const read = await this.#deps.store.list();
    if (read.ok) this.#own = read.value;
    else this.#deps.logger.warn('profiles.list-failed', { error: read.error });
    return [
      ...BUILT_INS.map((profile) => ({ profile, builtIn: true })),
      ...this.#own.map((profile) => ({ profile, builtIn: false })),
    ];
  }

  async duplicate(id: ProfileId): Promise<Result<ProfileEntry, ProfileError>> {
    const source = [...BUILT_INS, ...this.#own].find((profile) => profile.id === id);
    if (!source) return err({ kind: 'not-found', id });
    return this.#store({ ...source, id: this.#deps.newId(), name: `${source.name} copy` });
  }

  save(profile: AutoProfile): Promise<Result<ProfileEntry, ProfileError>> {
    if (isBuiltIn(profile.id)) {
      return Promise.resolve(err({ kind: 'built-in', id: profile.id }));
    }
    return this.#store(profile);
  }

  async delete(id: ProfileId): Promise<Result<void, ProfileError>> {
    if (isBuiltIn(id)) return err({ kind: 'built-in', id });
    const deleted = await this.#deps.store.delete(id);
    if (!deleted.ok) return this.#failed(deleted.error);
    if (!deleted.value) return err({ kind: 'not-found', id });
    this.#own = this.#own.filter((profile) => profile.id !== id);
    this.#deps.logger.info('profiles.deleted', { id });
    return ok(undefined);
  }

  async #store(profile: AutoProfile): Promise<Result<ProfileEntry, ProfileError>> {
    const saved = await this.#deps.store.save(profile);
    if (!saved.ok) return this.#failed(saved.error);
    const known = this.#own.some((own) => own.id === profile.id);
    this.#own = known
      ? this.#own.map((own) => (own.id === profile.id ? profile : own))
      : [...this.#own, profile];
    this.#deps.logger.info('profiles.saved', { id: profile.id });
    return ok({ profile, builtIn: false });
  }

  #failed(error: { kind: string; message?: string }): Result<never, ProfileError> {
    this.#deps.logger.warn('profiles.write-failed', { error });
    return err({ kind: 'storage-failed', message: error.message ?? error.kind });
  }
}
