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
import { deleteRefusal } from './delete-guard';
import { freeName, planCopy } from './profile-copy';

export interface ProfileServiceDeps {
  store: ProfileRepository;
  newId: () => string;
  /** The profile chosen in Settings. */
  chosenId: () => ProfileId;
  /** Profiles belong to a roaster: only the active one's are listed (docs/spec/roasters.md). */
  activeRoaster: () => Pick<Roaster, 'id' | 'model'>;
  /** Any roaster by id, for copies: their names and the built-ins already there. */
  roaster: (id: RoasterId) => Pick<Roaster, 'name' | 'model'> | undefined;
  /** After a delete: the beans it unlinked are read again. */
  onDeleted?: () => void;
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
  /** Copies run one after another, so a second click sees the first copy. */
  #copies: Promise<unknown> = Promise.resolve();

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

  /** Every profile on the active roaster: its built-ins, then your own. */
  #here(): AutoProfile[] {
    return [...this.#builtIns(), ...this.#ownHere()];
  }

  #isBuiltIn(id: ProfileId): boolean {
    return this.#builtIns().some((profile) => profile.id === id);
  }

  /** The profile Auto runs: the chosen one if this roaster has it, else its first built-in. */
  active(): AutoProfile {
    const all = this.#here();
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

  /** A copy of your own, called `name` ("Light curve copy" without one), in one write. */
  async duplicate(id: ProfileId, name?: string): Promise<Result<ProfileEntry, ProfileError>> {
    const source = this.#here().find((p) => p.id === id);
    if (!source) return err({ kind: 'not-found', id });
    const copy = {
      ...source,
      id: this.#deps.newId(),
      name: name ?? `${source.name} copy`,
      source: { kind: 'profile' as const, profileId: source.id },
    };
    return this.#store(copy, this.#deps.activeRoaster().id);
  }

  /** A new curve profile from the milestone builder (docs/spec/roast-control.md). */
  fromMilestones(milestones: Milestones): Promise<Result<ProfileEntry, ProfileError>> {
    const base = builderBase(this.#builtIns());
    if (!base) throw new Error('A roaster model must ship a curve profile');
    const name = freeName(MILESTONES_NAME, new Set(this.#ownHere().map((p) => p.name)));
    const profile = profileFromMilestones({ milestones, base, id: this.#deps.newId(), name });
    return this.#store(profile, this.#deps.activeRoaster().id);
  }

  /**
   * A copy on another roaster, which hasn't been roasted there yet, named after the roaster it
   * came from: "Light · Steps (from Simulator)". One copy of a profile per roaster.
   */
  copyTo(id: ProfileId, roasterId: RoasterId): Promise<Result<ProfileEntry, ProfileError>> {
    const copied = this.#copies.then(() => this.#copyTo(id, roasterId));
    this.#copies = copied.catch(() => undefined);
    return copied;
  }

  async #copyTo(id: ProfileId, roasterId: RoasterId): Promise<Result<ProfileEntry, ProfileError>> {
    const source = [...this.#builtIns(), ...this.#ownHere()].find((p) => p.id === id);
    const target = this.#deps.roaster(roasterId);
    if (!source || !target) return err({ kind: 'not-found', id });
    const there = this.#own.filter((own) => own.roasterId === roasterId).map((own) => own.profile);
    const from = this.#deps.roaster(this.#deps.activeRoaster().id)?.name;
    const plan = planCopy(source, there, ROASTER_MODELS[target.model].profiles, from);
    if (plan.kind === 'already-copied') {
      return err({ kind: 'already-copied', id: plan.profile.id, name: plan.profile.name });
    }
    return this.#store(
      {
        ...source,
        id: this.#deps.newId(),
        name: plan.name,
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

  /** Imported profiles on the active roaster, all or nothing. */
  async addAll(profiles: readonly AutoProfile[]): Promise<Result<void, ProfileError>> {
    const roasterId = this.#deps.activeRoaster().id;
    const saved = await this.#deps.store.saveAll(profiles, roasterId);
    if (!saved.ok) return this.#failed(saved.error);
    this.#remember(profiles, roasterId);
    this.#deps.logger.info('profiles.imported', { ids: profiles.map((p) => p.id), roasterId });
    return ok(undefined);
  }

  save(profile: AutoProfile): Promise<Result<ProfileEntry, ProfileError>> {
    if (this.#isBuiltIn(profile.id)) {
      return Promise.resolve(err({ kind: 'built-in', id: profile.id }));
    }
    const owner = this.#own.find((own) => own.profile.id === profile.id)?.roasterId;
    return this.#store(profile, owner ?? this.#deps.activeRoaster().id);
  }

  delete(id: ProfileId): Promise<Result<void, ProfileError>> {
    return this.deleteMany([id]);
  }

  /**
   * Your own, in one write, all or nothing. A built-in, the profile Auto uses or the one it runs
   * (the same until Drop, as Auto reads `active()` on every tick) refuses them all.
   */
  async deleteMany(ids: readonly ProfileId[]): Promise<Result<void, ProfileError>> {
    const inUse = [this.#deps.chosenId(), this.active().id];
    const refused = deleteRefusal(ids, { isBuiltIn: (id) => this.#isBuiltIn(id), inUse });
    if (refused) {
      this.#deps.logger.warn('profiles.delete-refused', { id: refused.id, reason: refused.kind });
      return err(refused);
    }
    const deleted = await this.#deps.store.deleteMany(ids);
    if (!deleted.ok) return this.#failed(deleted.error);
    if (deleted.value === 0) return err({ kind: 'not-found', id: ids.join(', ') });
    this.#own = this.#own.filter((own) => !ids.includes(own.profile.id));
    this.#deps.logger.info('profiles.deleted', { ids });
    this.#deps.onDeleted?.();
    return ok(undefined);
  }

  async #store(
    profile: AutoProfile,
    roasterId: RoasterId,
  ): Promise<Result<ProfileEntry, ProfileError>> {
    const saved = await this.#deps.store.save(profile, roasterId);
    if (!saved.ok) return this.#failed(saved.error);
    this.#remember([profile], roasterId);
    this.#deps.logger.info('profiles.saved', { id: profile.id, roasterId });
    return ok({ profile, builtIn: false });
  }

  /** Saved ones in memory, each replacing the one with its id. */
  #remember(profiles: readonly AutoProfile[], roasterId: RoasterId): void {
    const ids = new Set(profiles.map((p) => p.id));
    const others = this.#own.filter((own) => !ids.has(own.profile.id));
    this.#own = [...others, ...profiles.map((profile) => ({ profile, roasterId }))];
  }

  #failed(error: { kind: string; message?: string }): Result<never, ProfileError> {
    this.#deps.logger.warn('profiles.write-failed', { error });
    return err({ kind: 'storage-failed', message: error.message ?? error.kind });
  }
}
