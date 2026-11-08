import type { AutoProfile } from '@roastpilot/shared';
import { isSoak } from './phase-plan';

/**
 * Watches for dry end, once per roast. The temperature starts above it at charge and falls through
 * it, so it only counts once BT has been below it and climbs back to it, outside the soak. With no
 * soak, the first step runs from charge and the dip still keeps it from counting too early.
 */
export class DryEndWatch {
  readonly #profile: AutoProfile;
  #wasBelow = false;
  #reached = false;

  constructor(profile: AutoProfile) {
    this.#profile = profile;
  }

  /** True on the one reading dry end comes. */
  next(phaseIndex: number, btC: number | undefined): boolean {
    if (this.#reached || btC === undefined) return false;
    const { dryEndC } = this.#profile;
    if (btC < dryEndC) {
      this.#wasBelow = true;
      return false;
    }
    if (!this.#wasBelow || isSoak(this.#profile, phaseIndex)) return false;
    this.#reached = true;
    return true;
  }
}
