import {
  builderBase,
  profileFromMilestones,
  type Logger,
  type ProfileRepository,
} from '@roastpilot/core';
import { ROASTER_MODELS } from '@roastpilot/drivers';
import {
  err,
  ok,
  type AutoProfile,
  type Milestones,
  type ProfileEntry,
  type ProfileError,
  type ProfileId,
  type Result,
  type Roaster,
  type RoasterId,
} from '@roastpilot/shared';

export interface ProfileServiceDeps {
  store: ProfileRepository;
  newId: () => string;
  /** The profile chosen in Settings. */
  chosenId: () => ProfileId;
  /** Profiles belong to a roaster: only the active one's are listed (docs/spec/roasters.md). */
  activeRoaster: () => Pick<Roaster, 'id' | 'model'>;
  logger: Logger;
}

/** What the milestone builder calls its profiles: "Milestones", "Milestones 2" and so on. */
const MILESTONES_NAME = 'Milestones';

interface OwnProfile {
  profile: AutoProfile;
  roasterId: RoasterId;
}

/** Built-ins and your own profiles as one list; Auto reads the choice from memory on every tick. */
export class ProfileService {
  readonly #deps: ProfileServiceDeps;
  #own: OwnProfile[] = [];

  constructor(deps: ProfileServiceDeps) {
    this.#deps = deps;
  }

  #builtIns(): readonly AutoProfile[] {
    return ROASTER_MODELS[this.#deps.activeRoaster().model].profiles;
  }

  #ownHere(): AutoProfile[] {
    const { id } = this.#deps.activeRoaster();
    return this.#own.filter((own) => own.roasterId === id).map((own) => own.profile);
  }

  #isBuiltIn(id: ProfileId): boolean {
    return this.#builtIns().some((profile) => profile.id === id);
  }

  /** The profile Auto runs: the chosen one if this roaster has it, else its first built-in. */
  active(): AutoProfile {
    const all = [...this.#builtIns(), ...this.#ownHere()];
    const chosen = all.find((profile) => profile.id === this.#deps.chosenId());
    const profile = chosen ?? all[0];
    if (!profile) throw new Error('A roaster model must ship at least one profile');
    return profile;
  }

  /** Reads your own from storage. Built-ins alone, logged, when it can't. */
  async list(): Promise<ProfileEntry[]> {
    const read = await this.#deps.store.list();
    if (read.ok) this.#own = read.value;
    else this.#deps.logger.warn('profiles.list-failed', { error: read.error });
    return [
      ...this.#builtIns().map((profile) => ({ profile, builtIn: true })),
      ...this.#ownHere().map((profile) => ({ profile, builtIn: false })),
    ];
  }

  async duplicate(id: ProfileId): Promise<Result<ProfileEntry, ProfileError>> {
    const source = [...this.#builtIns(), ...this.#ownHere()].find((p) => p.id === id);
    if (!source) return err({ kind: 'not-found', id });
    const copy = {
      ...source,
      id: this.#deps.newId(),
      name: `${source.name} copy`,
      source: { kind: 'profile' as const, profileId: source.id },
    };
    return this.#store(copy, this.#deps.activeRoaster().id);
  }

  /** A new curve profile from the milestone builder (docs/spec/roast-control.md). */
  fromMilestones(milestones: Milestones): Promise<Result<ProfileEntry, ProfileError>> {
    const base = builderBase(this.#builtIns());
    if (!base) throw new Error('A roaster model must ship a curve profile');
    const taken = new Set(this.#ownHere().map((p) => p.name));
    let name = MILESTONES_NAME;
    for (let n = 2; taken.has(name); n++) name = `${MILESTONES_NAME} ${String(n)}`;
    const profile = profileFromMilestones({ milestones, base, id: this.#deps.newId(), name });
    return this.#store(profile, this.#deps.activeRoaster().id);
  }

  /** A copy on another roaster, which hasn't been roasted there yet. */
  async copyTo(id: ProfileId, roasterId: RoasterId): Promise<Result<ProfileEntry, ProfileError>> {
    const source = [...this.#builtIns(), ...this.#ownHere()].find((p) => p.id === id);
    if (!source) return err({ kind: 'not-found', id });
    return this.#store(
      {
        ...source,
        id: this.#deps.newId(),
        needsCalibration: true,
        source: { kind: 'profile', profileId: source.id },
      },
      roasterId,
    );
  }

  /** A profile made elsewhere (from a roast), on the roaster it belongs to. */
  addOn(profile: AutoProfile, roasterId: RoasterId): Promise<Result<ProfileEntry, ProfileError>> {
    return this.#store(profile, roasterId);
  }

  save(profile: AutoProfile): Promise<Result<ProfileEntry, ProfileError>> {
    if (this.#isBuiltIn(profile.id)) {
      return Promise.resolve(err({ kind: 'built-in', id: profile.id }));
    }
    const owner = this.#own.find((own) => own.profile.id === profile.id)?.roasterId;
    return this.#store(profile, owner ?? this.#deps.activeRoaster().id);
  }

  async delete(id: ProfileId): Promise<Result<void, ProfileError>> {
    if (this.#isBuiltIn(id)) return err({ kind: 'built-in', id });
    const deleted = await this.#deps.store.delete(id);
    if (!deleted.ok) return this.#failed(deleted.error);
    if (!deleted.value) return err({ kind: 'not-found', id });
    this.#own = this.#own.filter((own) => own.profile.id !== id);
    this.#deps.logger.info('profiles.deleted', { id });
    return ok(undefined);
  }

  async #store(
    profile: AutoProfile,
    roasterId: RoasterId,
  ): Promise<Result<ProfileEntry, ProfileError>> {
    const saved = await this.#deps.store.save(profile, roasterId);
    if (!saved.ok) return this.#failed(saved.error);
    const others = this.#own.filter((own) => own.profile.id !== profile.id);
    this.#own = [...others, { profile, roasterId }];
    this.#deps.logger.info('profiles.saved', { id: profile.id, roasterId });
    return ok({ profile, builtIn: false });
  }

  #failed(error: { kind: string; message?: string }): Result<never, ProfileError> {
    this.#deps.logger.warn('profiles.write-failed', { error });
    return err({ kind: 'storage-failed', message: error.message ?? error.kind });
  }
}
