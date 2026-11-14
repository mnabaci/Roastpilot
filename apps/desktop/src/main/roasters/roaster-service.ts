import { newRoaster, type Logger, type RoasterRepository } from '@roastpilot/core';
import { BUILT_IN_ROASTERS } from '@roastpilot/drivers';
import {
  err,
  modelFacts,
  ok,
  type ConnectTarget,
  type NewRoaster,
  type Result,
  type Roaster,
  type RoasterError,
  type RoasterId,
  type SaveWiringError,
  type SaveWiringRequest,
  type StorageError,
} from '@roastpilot/shared';
import { ROASTER_MODELS } from '../roaster-models';

export interface RoasterServiceDeps {
  repository: RoasterRepository;
  /** A roaster is connected: records wait, so limits can't change under a running session. */
  inUse: () => boolean;
  onChange: (roasters: Roaster[]) => void;
  logger: Logger;
}

const failed = (error: StorageError): RoasterError =>
  error.kind === 'not-found' ? error : { kind: 'storage-failed', message: error.message };

/**
 * The roaster records, served from memory so safety rules and Auto can read the active one on
 * every tick (docs/spec/roasters.md). Until they load, or if the database can't be read, the two
 * built-in records stand in.
 */
export class RoasterService {
  readonly #deps: RoasterServiceDeps;
  #roasters: readonly Roaster[] = BUILT_IN_ROASTERS;

  constructor(deps: RoasterServiceDeps) {
    this.#deps = deps;
  }

  /** Always one: a database with none active falls back to the first. */
  active(): Roaster {
    const active = this.#roasters.find((r) => r.active) ?? this.#roasters[0];
    if (active) return active;
    throw new Error('No roaster records: the built-ins should always be there');
  }

  get all(): readonly Roaster[] {
    return this.#roasters;
  }

  async load(): Promise<Roaster[]> {
    const read = await this.#deps.repository.list();
    if (!read.ok) {
      this.#deps.logger.warn('roasters.load-failed', { error: read.error });
    } else if (read.value.length > 0) {
      this.#roasters = read.value;
    }
    return [...this.#roasters];
  }

  async add(request: NewRoaster): Promise<Result<Roaster, RoasterError>> {
    const added = await this.#deps.repository.add(
      newRoaster(request.name, ROASTER_MODELS.get(request.model)),
    );
    if (!added.ok) return this.#refused(added.error);
    this.#deps.logger.info('roasters.added', { id: added.value.id, model: added.value.model });
    this.#set([...this.#roasters, added.value]);
    return ok(added.value);
  }

  /** Imported records, all or nothing; never active (docs/spec/data-model.md). */
  async addAll(records: readonly Omit<Roaster, 'id'>[]): Promise<Result<Roaster[], RoasterError>> {
    const added = await this.#deps.repository.addAll(
      records.map((record) => ({ ...record, active: false })),
    );
    if (!added.ok) return this.#refused(added.error);
    this.#deps.logger.info('roasters.imported', { ids: added.value.map((r) => r.id) });
    this.#set([...this.#roasters, ...added.value]);
    return ok(added.value);
  }

  async save(roaster: Roaster): Promise<Result<Roaster, RoasterError>> {
    if (this.#deps.inUse()) return err({ kind: 'in-use' });
    const known = this.#roasters.find((r) => r.id === roaster.id);
    if (!known) return err({ kind: 'not-found', id: roaster.id });
    // `active` only changes through setActive, and a model never changes.
    const next = { ...roaster, active: known.active, model: known.model };
    const saved = await this.#deps.repository.save(next);
    if (!saved.ok) return this.#refused(saved.error);
    this.#deps.logger.info('roasters.saved', { id: next.id });
    this.#set(this.#roasters.map((r) => (r.id === next.id ? next : r)));
    return ok(next);
  }

  /**
   * A generic TC4's wiring and minimum fan: unlike the rest of the record, also while it is
   * connected, so a probe can be picked by its live reading, but never while roasting
   * (docs/spec/roasters.md, Generic TC4). The caller reconnects a connected roaster.
   */
  async saveWiring(
    { id, wiring, minFanHeatingPct }: SaveWiringRequest,
    roasting: boolean,
  ): Promise<Result<Roaster, SaveWiringError>> {
    if (roasting) return err({ kind: 'roasting' });
    const known = this.#roasters.find((r) => r.id === id);
    if (!known) return err({ kind: 'not-found', id });
    if (!modelFacts(known.model).wiring) {
      throw new Error(`A ${known.model} roaster has no wiring to save`);
    }
    const next = { ...known, wiring, minFanHeatingPct };
    const saved = await this.#deps.repository.save(next);
    if (!saved.ok) return this.#refused(saved.error);
    this.#deps.logger.info('roasters.wiring-saved', { id, wiring, minFanHeatingPct });
    this.#set(this.#roasters.map((r) => (r.id === id ? next : r)));
    return ok(next);
  }

  async setActive(id: RoasterId): Promise<Result<void, RoasterError>> {
    if (this.#deps.inUse()) return err({ kind: 'in-use' });
    const set = await this.#deps.repository.setActive(id);
    if (!set.ok) return this.#refused(set.error);
    this.#deps.logger.info('roasters.active-changed', { id });
    this.#set(this.#roasters.map((r) => ({ ...r, active: r.id === id })));
    return ok(undefined);
  }

  async delete(id: RoasterId): Promise<Result<void, RoasterError>> {
    if (this.active().id === id) return err({ kind: 'active' });
    const usage = await this.#deps.repository.usage(id);
    if (!usage.ok) return this.#refused(usage.error);
    if (usage.value.roasts > 0 || usage.value.profiles > 0) {
      return err({ kind: 'has-roasts', ...usage.value });
    }
    const deleted = await this.#deps.repository.delete(id);
    if (!deleted.ok) return this.#refused(deleted.error);
    this.#deps.logger.info('roasters.deleted', { id });
    this.#set(this.#roasters.filter((r) => r.id !== id));
    return ok(undefined);
  }

  /** A port or the Simulator was picked: the roaster of that kind becomes active and keeps it. */
  async chooseConnection(target: ConnectTarget): Promise<Result<void, RoasterError>> {
    const fits = (r: Roaster) => modelFacts(r.model).connection === target.kind;
    const active = this.active();
    const roaster = fits(active) ? active : this.#roasters.find(fits);
    if (!roaster) return err({ kind: 'not-found', id: active.id });
    const saved = await this.save({ ...roaster, connection: target });
    if (!saved.ok) return saved;
    return roaster.id === active.id ? ok(undefined) : this.setActive(roaster.id);
  }

  #set(roasters: readonly Roaster[]): void {
    this.#roasters = roasters;
    this.#deps.onChange([...roasters]);
  }

  #refused(error: StorageError): Result<never, RoasterError> {
    this.#deps.logger.warn('roasters.write-failed', { error });
    return err(failed(error));
  }
}
